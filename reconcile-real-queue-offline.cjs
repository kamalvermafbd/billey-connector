"use strict";

/*
Proposed standalone file: reconcile-real-queue-offline.cjs

Usage:
  node reconcile-real-queue-offline.cjs "C:\path\to\connector"

No real Axios implementation is loaded.
Every scenario runs in a fresh child process.
*/

const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const CASES = [
    "sequential",
    "concurrent",
    "guid-recovery",
    "invalid-books",
    "http-error",
    "timeout",
    "network-error",
    "draining",
    "ownership",
    "revocation"
];

const root = path.resolve(".");
const scenario = process.argv[2];
if (!scenario) {
    let failed = false;

    for (const name of CASES) {
        const env = { ...process.env };

        // Prevent inherited Node preload scripts in children.
        delete env.NODE_OPTIONS;
        delete env.NODE_PATH;
        delete env.NODE_V8_COVERAGE;

        const child = spawnSync(
            process.execPath,
            [__filename, root, name],
            {
                env,
                encoding: "utf8",
                timeout: 12000,
                killSignal: "SIGKILL",
                maxBuffer: 1024 * 1024,
                windowsHide: true
            }
        );

        const expected = `PASS ${name}`;

        if (
            child.error ||
            child.status !== 0 ||
            child.stdout.trim() !== expected
        ) {
            failed = true;
            console.error(`FAIL ${name}`);
            if (child.error) console.error(child.error.message);
            if (child.stdout) console.error(child.stdout.trim());
            if (child.stderr) console.error(child.stderr.trim());
        } else {
            console.log(expected);
        }
    }

    process.exit(failed ? 1 : 0);
}

// Child process only.
const watchdog = setTimeout(() => {
    process.stderr.write(`FAIL ${scenario}: child watchdog\n`);
    process.exit(124);
}, 8000);

function forbiddenNetwork() {
    throw new Error("OFFLINE_NETWORK_FORBIDDEN");
}

// Load built-ins before replacing their network entry points.
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const tls = require("node:tls");
const dgram = require("node:dgram");
const dns = require("node:dns");

http.request = forbiddenNetwork;
http.get = forbiddenNetwork;
https.request = forbiddenNetwork;
https.get = forbiddenNetwork;
net.connect = forbiddenNetwork;
net.createConnection = forbiddenNetwork;
net.Socket.prototype.connect = forbiddenNetwork;
tls.connect = forbiddenNetwork;
dgram.createSocket = forbiddenNetwork;
dns.lookup = forbiddenNetwork;
dns.resolve = forbiddenNetwork;
globalThis.fetch = forbiddenNetwork;

// Catch accidental filesystem mutation by loaded production modules.
const fs = require("node:fs");
for (const method of [
    "writeFile", "writeFileSync",
    "appendFile", "appendFileSync",
    "createWriteStream",
    "mkdir", "mkdirSync",
    "unlink", "unlinkSync",
    "rename", "renameSync",
    "rm", "rmSync"
]) {
    if (typeof fs[method] === "function") {
        fs[method] = () => {
            throw new Error(`OFFLINE_FILE_MUTATION_FORBIDDEN:${method}`);
        };
    }
}

const Module = require("node:module");
const { AsyncResource } = require("node:async_hooks");

let transport = null;
let activeHttp = 0;
let maximumActiveHttp = 0;
const calls = [];

function unexpectedAxiosMethod() {
    throw new Error("OFFLINE_UNEXPECTED_AXIOS_METHOD");
}

const mockAxios = new Proxy(Object.create(null), {
    get(_target, property) {
        if (property !== "post") return unexpectedAxiosMethod;

        return async (url, xml, options) => {
            assert.equal(url, "http://localhost:9000");
            assert.equal(typeof xml, "string");
            assert.equal(options.timeout, 120000);
            assert.equal(
                options.headers["Content-Type"],
                "application/xml"
            );

            assert.equal(typeof transport, "function");

            calls.push(xml);
            activeHttp++;
            maximumActiveHttp = Math.max(
                maximumActiveHttp,
                activeHttp
            );

            try {
                return await transport(xml, calls.length);
            } finally {
                activeHttp--;
            }
        };
    }
});

const originalLoad = Module._load;

Module._load = function offlineLoad(request, parent, isMain) {
    if (request === "axios") return mockAxios;

    // Fail closed if production switches to an Axios subpath.
    if (
        /(^|[\\/])axios([\\/]|$)/i.test(request)
    ) {
        throw new Error("OFFLINE_UNEXPECTED_AXIOS_IMPORT");
    }

    return originalLoad.call(this, request, parent, isMain);
};

// Production logs are suppressed only in this disposable process.
console.log = () => {};
console.trace = () => {};
console.error = () => {};

const load = relative =>
    require(path.join(root, relative));

const queue = load("src/tally/tallyRequestQueue.js");
const service = load("src/tally/tallyService.js");
const reconcile = load("src/reconciliations/reconcileNow.js");

// Deliberately keep interception installed for the entire child lifetime.

const COMPANY = "Offline Company";
const GUID =
    "755da616-c913-46c0-9ad0-de5499d071a0-00000003";
const OTHER_GUID =
    "755da616-c913-46c0-9ad0-de5499d071a0-00000004";

function xmlText(value) {
    return value.replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;"
    })[c]);
}

function companyResponse({
    guid = GUID,
    books = "20240401"
} = {}) {
    return `
<ENVELOPE>
  <HEADER><STATUS>1</STATUS></HEADER>
  <BODY><DATA><TALLYMESSAGE><COMPANY>
    <NAME>${xmlText(COMPANY)}</NAME>
    <GUID>${xmlText(guid)}</GUID>
    <BOOKSFROM>${xmlText(books)}</BOOKSFROM>
  </COMPANY></TALLYMESSAGE></DATA></BODY>
</ENVELOPE>`;
}

const selectionResponse =
    "<ENVELOPE><HEADER><STATUS>1</STATUS></HEADER>" +
    "<BODY><DATA/></BODY></ENVELOPE>";

function isSelection(xml) {
    return /<REPORTNAME>\s*List of Accounts\s*<\/REPORTNAME>/
        .test(xml);
}

function isCompany(xml) {
    return /<SUBTYPE>\s*Company\s*<\/SUBTYPE>/.test(xml);
}

function kind(xml) {
    if (isSelection(xml)) return "selection";
    if (isCompany(xml)) return "company";
    throw new Error("OFFLINE_UNEXPECTED_REQUEST_XML");
}

function ok(xml) {
    return {
        status: 200,
        data: isSelection(xml)
            ? selectionResponse
            : companyResponse()
    };
}

function fetchCompany() {
    return reconcile.fetchVerifiedReconciliationCompany({
        companyName: COMPANY,
        expectedCompanyGuid: GUID
    });
}

function assertVerified(result) {
    assert.deepEqual(result, {
        companyGuid: GUID,
        companyName: COMPANY,
        booksBeginningFrom: "20240401"
    });
    assert.equal(Object.isFrozen(result), true);
}

function assertHealthyIdle() {
    const status = queue.getTallyQueueStatus();
    assert.equal(status.pendingOperations, 0);
    assert.equal(status.runningOperations, 0);
    assert.equal(status.idle, true);
    assert.equal(queue.getTallyTransportUncertainty(), null);
    assert.equal(activeHttp, 0);
}

function deferred() {
    let resolve;
    const promise = new Promise(r => { resolve = r; });
    return { promise, resolve };
}

function observed(promise) {
    // Observe immediately; retain the original promise/error.
    promise.catch(() => {});
    return promise;
}

async function run() {
    switch (scenario) {

        case "selection-rejection": {
            const invalidResponses = [
                {
                    name: "empty",
                    xml: "",
                    error: /RECONCILE_SELECTION_XML_INVALID/
                },
                {
                    name: "malformed",
                    xml: "<ENVELOPE><HEADER>",
                    error: /RECONCILE_SELECTION_XML_INVALID/
                },
                {
                    name: "line-error",
                    xml: "<ENVELOPE><HEADER><STATUS>1</STATUS></HEADER><BODY><LINEERROR>Invalid company</LINEERROR></BODY></ENVELOPE>",
                    error: /RECONCILE_SELECTION_TALLY_ERROR/
                },
                {
                    name: "unsuccessful-status",
                    xml: "<ENVELOPE><HEADER><STATUS>0</STATUS></HEADER><BODY><DATA>test</DATA></BODY></ENVELOPE>",
                    error: /RECONCILE_SELECTION_NOT_CONFIRMED/
                },
                {
                    name: "missing-status",
                    xml: "<ENVELOPE><HEADER><VERSION>1</VERSION></HEADER><BODY><DATA>test</DATA></BODY></ENVELOPE>",
                    error: /RECONCILE_SELECTION_NOT_CONFIRMED/
                },
                {
                    name: "wrong-root",
                    xml: "<RESULT><STATUS>1</STATUS></RESULT>",
                    error: /RECONCILE_SELECTION_ENVELOPE_INVALID/
                },
                {
                    name: "dtd",
                    xml: "<!DOCTYPE ENVELOPE><ENVELOPE><HEADER><STATUS>1</STATUS></HEADER><BODY/></ENVELOPE>",
                    error: /RECONCILE_SELECTION_XML_INVALID/
                },

{
    name: "non-string",
    xml: { unexpected: true },
    error: /RECONCILE_SELECTION_XML_INVALID/
},
{
    name: "duplicate-header",
    xml: "<ENVELOPE><HEADER><STATUS>1</STATUS></HEADER><HEADER><STATUS>1</STATUS></HEADER><BODY><DATA>test</DATA></BODY></ENVELOPE>",
    error: /RECONCILE_SELECTION_ENVELOPE_INVALID/
},
{
    name: "duplicate-status",
    xml: "<ENVELOPE><HEADER><STATUS>1</STATUS><STATUS>1</STATUS></HEADER><BODY><DATA>test</DATA></BODY></ENVELOPE>",
    error: /RECONCILE_SELECTION_NOT_CONFIRMED/
}

            ];

            for (const testCase of invalidResponses) {
                const before = calls.length;

                transport = async xml => ({
                    status: 200,
                    data: isSelection(xml)
                        ? testCase.xml
                        : companyResponse()
                });

                await assert.rejects(
                    fetchCompany(),
                    testCase.error,
                    testCase.name
                );

                assert.equal(
                    calls.length - before,
                    1,
                    `${testCase.name}: Company request must not execute`
                );

                assertHealthyIdle();
            }

            transport = async xml => ok(xml);

            const beforeRecovery = calls.length;

            assertVerified(await fetchCompany());

            assert.deepEqual(
                calls.slice(beforeRecovery).map(kind),
                ["selection", "company"]
            );

            assertHealthyIdle();
            break;
        }


        case "verified-context": {
            transport = async xml => ok(xml);

            let callbackExecuted = false;

            const result =
                await reconcile.runWithVerifiedReconciliationCompany({
                    companyName: COMPANY,
                    expectedCompanyGuid: GUID,

                    operation: async (context, control) => {
                        callbackExecuted = true;

                        control.assertActive();

                        assert.equal(
                            context.companyGuid,
                            GUID
                        );

                        assert.equal(
                            context.companyName,
                            COMPANY
                        );

                        assert.equal(
                            context.booksBeginningFrom,
                            "20240401"
                        );

                        assert.equal(
                            Object.isFrozen(context),
                            true
                        );

                        const ledgerXml =
                            context.buildLedgerRequest();

                        assert.equal(
                            typeof ledgerXml,
                            "string"
                        );

                        assert.ok(ledgerXml.length > 0);

                        const boundary =
                            context.buildVoucherRequest({
                                voucherGuids: [GUID],
                                fromDate: "20240401",
                                toDate: "20240430"
                            });

                        assert.equal(
                            boundary.fromDate,
                            "20240401"
                        );

                        assert.equal(
                            boundary.toDate,
                            "20240430"
                        );

                        assert.equal(
                            boundary.company,
                            COMPANY
                        );

                        assert.ok(
                            typeof boundary.xml === "string" &&
                            boundary.xml.length > 0
                        );

                        await assert.rejects(
                            async () =>
                                context.buildVoucherRequest({
                                    voucherGuids: [GUID],
                                    fromDate: "20240331",
                                    toDate: "20240430"
                                }),
                            /RECONCILE_VOUCHER_BEFORE_BOOKS_BEGINNING/
                        );

                        await assert.rejects(
                            async () =>
                                context.buildVoucherRequest({
                                    voucherGuids: [GUID],
                                    fromDate: "20240401",
                                    toDate: "20240230"
                                }),
                            /RECONCILE_VOUCHER_DATE_RANGE_INVALID/
                        );

                        control.assertActive();

                        return "VERIFIED_CONTEXT_OK";
                    }
                });

            assert.equal(callbackExecuted, true);
            assert.equal(result, "VERIFIED_CONTEXT_OK");

            assert.deepEqual(
                calls.map(kind),
                ["selection", "company"]
            );

            assertHealthyIdle();

            assertVerified(await fetchCompany());
            assertHealthyIdle();

            break;
        }


        case "sequential": {
            transport = async xml => ok(xml);

            assertVerified(await fetchCompany());

            assert.deepEqual(
                calls.map(kind),
                ["selection", "company"]
            );
            assert.equal(maximumActiveHttp, 1);
            assertHealthyIdle();
            break;
        }

        case "concurrent": {
            const entered = deferred();
            const release = deferred();

            transport = async (xml, ordinal) => {
                if (ordinal === 1) {
                    entered.resolve();
                    await release.promise;
                }
                return ok(xml);
            };

            const first = observed(fetchCompany());
            await entered.promise;

            const second = observed(fetchCompany());

            assert.equal(calls.length, 1);
            assert.equal(
                queue.getTallyQueueStatus().runningOperations,
                1
            );
            assert.equal(
                queue.getTallyQueueStatus().pendingOperations,
                1
            );

            release.resolve();

            assertVerified(await first);
            assertVerified(await second);

            assert.deepEqual(calls.map(kind), [
                "selection", "company",
                "selection", "company"
            ]);
            assert.equal(maximumActiveHttp, 1);
            assertHealthyIdle();
            break;
        }

        case "guid-recovery": {
            let wrong = true;

            transport = async xml => ({
                status: 200,
                data: isSelection(xml)
                    ? selectionResponse
                    : companyResponse({
                        guid: wrong ? OTHER_GUID : GUID
                    })
            });

            await assert.rejects(
                fetchCompany(),
                /RECONCILE_COMPANY_GUID_MISMATCH/
            );
            assertHealthyIdle();

            wrong = false;
            assertVerified(await fetchCompany());
            assertHealthyIdle();
            break;
        }

        case "invalid-books": {
            transport = async xml => ({
                status: 200,
                data: isSelection(xml)
                    ? selectionResponse
                    : companyResponse({ books: "20240230" })
            });

            await assert.rejects(
                fetchCompany(),
                /RECONCILE_BOOKSFROM_INVALID/
            );

            assert.equal(calls.length, 2);
            assertHealthyIdle();
            break;
        }

        case "http-error": {
            const original = new Error("mock HTTP 503");
            original.response = {
                status: 503,
                data: "offline fixture"
            };

            transport = async () => { throw original; };

            await assert.rejects(
                fetchCompany(),
                error => error === original
            );

            assert.equal(calls.length, 1);
            assertHealthyIdle();

            transport = async xml => ok(xml);
            assertVerified(await fetchCompany());
            assertHealthyIdle();
            break;
        }

        case "timeout":
        case "network-error": {
            const original = new Error(`mock ${scenario}`);
            original.code = scenario === "timeout"
                ? "ECONNABORTED"
                : "ECONNRESET";

            // Deliberately no .response property.
            transport = async () => { throw original; };

            await assert.rejects(
                fetchCompany(),
                error => error === original
            );

            const latch = queue.getTallyTransportUncertainty();
            assert.ok(latch);
            assert.equal(queue.getTallyQueueStatus().idle, false);

            const count = calls.length;

            await assert.rejects(
                fetchCompany(),
                /TALLY_TRANSPORT_OUTCOME_UNCERTAIN/
            );

            assert.equal(calls.length, count);
            assert.equal(
                queue.getTallyTransportUncertainty(),
                latch
            );
            assert.equal(
                queue.getTallyQueueStatus().pendingOperations,
                0
            );
            assert.equal(
                queue.getTallyQueueStatus().runningOperations,
                0
            );
            assert.equal(queue.getTallyQueueStatus().idle, false);
            break;
        }

        case "draining": {
            const entered = deferred();
            const release = deferred();
            let acceptedRequest;
            let staleRequest;

            transport = async xml => {
                if (xml === "<offline-drain/>") {
                    entered.resolve();
                    await release.promise;
                    return { status: 200, data: "drained" };
                }
                return ok(xml);
            };

            const owner = observed(
                queue.runReconciliationTallyOperation(() => {
                    staleRequest = AsyncResource.bind(
                        () => service.sendToTally("<offline-stale/>")
                    );

                    acceptedRequest = observed(
                        service.sendToTally("<offline-drain/>")
                    );

                    // Intentionally return without awaiting it.
                    return "callback-returned";
                })
            );

            await entered.promise;

            const next = observed(fetchCompany());
            assert.equal(calls.length, 1);
            assert.equal(queue.getTallyQueueStatus().idle, false);
            assert.equal(
                queue.getTallyQueueStatus().pendingOperations,
                1
            );

            release.resolve();

            assert.equal(await owner, "callback-returned");
            assert.equal(await acceptedRequest, "drained");
            assertVerified(await next);

            const count = calls.length;
            await assert.rejects(
                staleRequest(),
                /RECONCILE_OWNER_REVOKED/
            );
            assert.equal(calls.length, count);
            assertHealthyIdle();
            break;
        }

       
        case "ownership": {
            const entered = deferred();
            const release = deferred();

            transport = async xml => {
                if (xml === "<offline-owned/>") {
                    entered.resolve();
                    await release.promise;
                    return { status: 200, data: "owned" };
                }

                return ok(xml);
            };

            const owner = observed(
                queue.runReconciliationTallyOperation(async () => {
                    const accepted = observed(
                        service.sendToTally("<offline-owned/>")
                    );

                    // Wait until the accepted request actually
                    // enters the mocked HTTP transport.
                    await entered.promise;

                    try {
                        await assert.rejects(
                            service.sendToTally("<offline-concurrent/>"),
                            /RECONCILE_CONCURRENT_REQUEST_FORBIDDEN/
                        );
                    } finally {
                        // Never leave the accepted request blocked.
                        release.resolve();
                    }

                    await accepted;
                })
            );

            try {
                await assert.rejects(
                    owner,
                    /RECONCILE_CONCURRENT_REQUEST_FORBIDDEN/
                );

                assert.equal(calls.length, 1);
                assertHealthyIdle();

                assertVerified(await fetchCompany());
                assertHealthyIdle();
            } finally {
                release.resolve();
            }

            break;
        }


        case "revocation": {
            const entered = deferred();
            const release = deferred();
            const reason = new Error("offline ownership revoked");
            let control;

            transport = async xml => {
                if (xml === "<offline-revoke/>") {
                    entered.resolve();
                    await release.promise;
                    return { status: 200, data: "settled" };
                }
                return ok(xml);
            };

            const owner = observed(
                queue.runReconciliationTallyOperation(async c => {
                    control = c;
                    await service.sendToTally("<offline-revoke/>");
                    c.assertActive();
                    await service.sendToTally("<must-not-dispatch/>");
                })
            );

            await entered.promise;
            control.revoke(reason);

            const next = observed(fetchCompany());

            assert.equal(calls.length, 1);
            assert.equal(queue.getTallyQueueStatus().idle, false);

            release.resolve();

            await assert.rejects(
                owner,
                error => error === reason
            );

            assertVerified(await next);
            assert.equal(
                calls.includes("<must-not-dispatch/>"),
                false
            );
            assertHealthyIdle();
            break;
        }

        default:
            throw new Error(`Unknown scenario: ${scenario}`);
    }

    assert.equal(activeHttp, 0);
}

run().then(
    () => {
        clearTimeout(watchdog);
        process.stdout.write(`PASS ${scenario}\n`);
        process.exit(0);
    },
    error => {
        clearTimeout(watchdog);
        process.stderr.write(
            `FAIL ${scenario}: ${error.stack || error}\n`
        );
        process.exit(1);
    }
);
