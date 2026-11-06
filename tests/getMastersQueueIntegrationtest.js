"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire, isBuiltin } = require("node:module");
const { EventEmitter } = require("node:events");
const { randomUUID } = require("node:crypto");

const root = path.resolve(__dirname, "..");
const handlerPath = path.join(root, "src/socket/secondSyncClientEvents.js");
const source = fs.readFileSync(handlerPath, "utf8");

function section(startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start);
    assert.ok(start >= 0, `Missing source marker: ${startMarker}`);
    assert.ok(end > start, `Invalid source boundary: ${endMarker}`);
    return source.slice(start, end);
}

const fingerprintSource = section(
    "function getMastersPayloadFingerprint(data) {",
    "function connectServer() {"
);
const handlerSource = section(
    "const getMastersMonitoringRecords = new WeakMap();",
    'syncSocket.on("getMastersVoucherGuids"'
);

const finalAckSource = section(
    "async function sendGetMastersTransferCompleteWithAck(requestId, session) {",
    'syncSocket.on("getMasters", async (data) => {'
);

function positiveIntegerConstant(name) {
    const match = finalAckSource.match(
        new RegExp(`\\bconst\\s+${name}\\s*=\\s*(\\d+)\\s*;`)
    );
    assert.ok(match, `Cannot read production constant: ${name}`);
    const value = Number(match[1]);
    assert.ok(Number.isSafeInteger(value) && value > 0);
    return value;
}

const finalAckPolicy = {
    attemptMs: positiveIntegerConstant("ACK_TIMEOUT_MS"),
    deadlineMs: positiveIntegerConstant("ACK_RETRY_DEADLINE_MS")
};
const expectedFinalAttempts = Math.ceil(
    finalAckPolicy.deadlineMs / finalAckPolicy.attemptMs
);
assert.ok(expectedFinalAttempts <= 256, "Retry policy exceeds test safety bound");

function bounded(promise, label, milliseconds = 3000) {
    let timer;
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            timer = setTimeout(
                () => reject(new Error(`Timeout: ${label}`)),
                milliseconds
            );
        })
    ]).finally(() => clearTimeout(timer));
}

const emptyXML =
    "<ENVELOPE><BODY><DATA><COLLECTION></COLLECTION></DATA></BODY></ENVELOPE>";

const unitCollectionXML =
    "<ENVELOPE><BODY><DATA><COLLECTION>" +
    "<UNIT><NAME>PCS</NAME></UNIT>" +
    "</COLLECTION></DATA></BODY></ENVELOPE>";

const unitObjectXML =
    "<ENVELOPE><BODY><DATA><TALLYMESSAGE><UNIT>" +
    "<GUID>fixture-unit-guid</GUID>" +
    "<MASTERID>1</MASTERID><ALTERID>1</ALTERID>" +
    "<NAME>PCS</NAME>" +
    "</UNIT></TALLYMESSAGE></DATA></BODY></ENVELOPE>";

function companyXML(company) {
    return "<ENVELOPE><BODY><DATA><TALLYMESSAGE><COMPANY>" +
        `<NAME>${company}</NAME><GUID>fixture-company-guid</GUID>` +
        "<BOOKSFROM>20240401</BOOKSFROM>" +
        "<STARTINGFROM>20240401</STARTINGFROM>" +
        "<FINANCIALYEARFROM>20240401</FINANCIALYEARFROM>" +
        "</COMPANY></TALLYMESSAGE></DATA></BODY></ENVELOPE>";
}

function createHarness(options = {}) {
    const cache = new Map();
    const gates = [];
    const tasks = [];
    const timers = new Set();
    const timerDetails = new Map();
    const finalTimerStorage = new (require("node:async_hooks").AsyncLocalStorage)();
    const finalInvocations = [];
    const finalAttempts = new Map();
    const peerErrors = [];
    let clockNow = Date.now();
    class FinalClockDate extends Date {
        static now() { return clockNow; }
    }
    const packets = [];
    const httpCalls = [];
    const files = new Map();
    let queue;
    let lateContext;
    let controller;

    function gate() {
        let resolve;
        const promise = new Promise(res => { resolve = res; });
        const result = { promise, resolve };
        gates.push(result);
        return result;
    }

    function track(promise) {
        promise.catch(() => {});
        tasks.push(promise);
        return promise;
    }

    function timer(callback, delay, ...args) {
        const id = setTimeout(() => {
            timers.delete(id);
            timerDetails.delete(id);
            callback(...args);
        }, delay);
        timers.add(id);
        const detail = { callback, delay, args };
        const finalInvocation = finalTimerStorage.getStore();
        if (finalInvocation) {
            detail.finalAckIdentity = {
                requestId: finalInvocation.requestId,
                attempt: ++finalInvocation.attempt
            };
        }
        timerDetails.set(id, detail);
        return id;
    }

    function clearTimer(id) {
        timers.delete(id);
        timerDetails.delete(id);
        clearTimeout(id);
    }

    const quiet = new Proxy({}, {
        get() { return () => {}; }
    });

    const fileBoundary = new Proxy(fs, {
        get(target, name) {
            if (name === "writeFileSync") {
                return (filename, data) => files.set(String(filename), data);
            }
            if (name === "appendFileSync") {
                return (filename, data) => {
                    const key = String(filename);
                    files.set(key, String(files.get(key) || "") + String(data));
                };
            }
            if (/^(write|append|mkdir|unlink|rm|rename|truncate|createWrite)/.test(String(name))) {
                return () => { throw new Error(`Unexpected filesystem mutation: ${String(name)}`); };
            }
            return Reflect.get(target, name);
        }
    });

    const axiosBoundary = {
        async post(url, xml) {
            assert.equal(url, "http://localhost:9000");
            const identity = queue.getTallyExecutionContext();
            assert.ok(identity, "HTTP must inherit the real execution identity");
            assert.equal(identity.state, "CALLBACK_RUNNING");
            const call = { xml, identity };
            httpCalls.push(call);

            if (httpCalls.length === 1) {
                lateContext = track(observeLate.promise.then(
                    () => queue.getTallyExecutionContext()
                ));
            }

            if (options.http) await options.http(call);

            if (/<SUBTYPE>\s*Company\s*<\/SUBTYPE>/i.test(xml)) {
                const company = /<ID TYPE="Name">([^<]+)<\/ID>/.exec(xml);
                assert.ok(company, "Company object request fixture must match");
                return { data: companyXML(company[1]) };
            }

            if (/<SUBTYPE>\s*Unit\s*<\/SUBTYPE>/i.test(xml)) {
                assert.equal(options.populatedUnit, true);
                assert.match(xml, /<ID TYPE="Name">PCS<\/ID>/);
                return { data: unitObjectXML };
            }

            const id = /<ID>\s*([^<]+?)\s*<\/ID>/.exec(xml)?.[1];

            if (options.populatedUnit && id === "Billey Unit Collection") {
                return { data: unitCollectionXML };
            }
            const allowedCollections = new Set([
                "BilleyMasterIdCollection",
                "Billey Unit Collection",
                "Billey Ledger Collection",
                "Billey Stock Group Collection",
                "Billey Stock Collection",
                "Billey Godown Collection",
                "Billey Cost Centre Collection"
            ]);
            const isSelection =
                /<REPORTNAME>\s*List of Accounts\s*<\/REPORTNAME>/i.test(xml);

            assert.ok(
                isSelection || allowedCollections.has(id),
                `Unrecognized Tally fixture request: ${String(id)}`
            );
            return { data: emptyXML };
        }
    };

    // Private module graph: real queue, extraction, parser and protocol code.
    function load(filename) {
        filename = path.resolve(filename);
        if (cache.has(filename)) return cache.get(filename).exports;
        assert.ok(
            filename.startsWith(root + path.sep),
            `Local module escaped repository: ${filename}`
        );
        const module = { exports: {} };
        cache.set(filename, module);
        const hostRequire = createRequire(filename);
        function dependency(name) {
            if (name === "axios") return axiosBoundary;
            if (name === "fs" || name === "node:fs") return fileBoundary;
            if (name.startsWith(".")) {
                return load(hostRequire.resolve(name));
            }
            if (name === "fast-xml-parser") return hostRequire(name);
            if (isBuiltin(name)) {
                const bare = name.replace(/^node:/, "");
                assert.ok(
                    ["async_hooks", "crypto", "path", "util", "events", "buffer"].includes(bare),
                    `Unexpected builtin dependency: ${name}`
                );
                return hostRequire(name);
            }
            throw new Error(`Unexpected external dependency: ${name}`);
        }
        try {
            const wrapper = vm.runInContext(
                "(function(require,module,exports,__filename,__dirname){\n" +
                fs.readFileSync(filename, "utf8") + "\n})",
                context,
                { filename }
            );
            wrapper(
                dependency, module, module.exports, filename, path.dirname(filename)
            );
            return module.exports;
        } catch (error) {
            cache.delete(filename);
            throw error;
        }
    }

    class Socket extends EventEmitter {
        constructor() {
            super();
            this.id = "connection-A";
            this.connected = true;
        }
        receive(event, payload) {
            packets.push({ direction: "in", event, payload, socketId: this.id });
            return super.emit(event, payload);
        }
        emit(event, payload) {
            packets.push({ direction: "out", event, payload, socketId: this.id });
            if (!this.connected) return false;
            if (event === "getMastersResult" && payload.success === true) {
                for (const collection of collections) {
                    this.receive("protocol:ready", {
                        requestId: payload.requestId,
                        collection,
                        success: true
                    });
                }
            } else if (event === "protocol:chunk") {
                options.onChunk?.(payload);
                if (options.chunkAck !== "lost") {
                    const ack = {
                        requestId: payload.requestId,
                        collection: payload.collection,
                        batchId: payload.batchId,
                        chunkIndex: payload.chunkIndex,
                        success: options.chunkAck !== "reject"
                    };
                    this.receive("protocol:received", ack);
                    if (options.chunkAck === "duplicate") {
                        this.receive("protocol:received", { ...ack });
                    }
                }
            } else if (event === "protocol:complete") {
                this.receive("protocol:completed", {
                    requestId: payload.requestId,
                    collection: payload.collection,
                    batchId: payload.batchId,
                    success: options.transferFailure !== true
                });
            } else if (event === "getMastersTransferComplete") {
                const attempt = (finalAttempts.get(payload.requestId) || 0) + 1;
                finalAttempts.set(payload.requestId, attempt);
                if (options.onFinal) {
                    try {
                        const returned = options.onFinal({ socket: this, payload, attempt });
                        if (returned && typeof returned.then === "function") {
                            returned.catch(error => peerErrors.push(error));
                            throw new Error("onFinal must be synchronous");
                        }
                    } catch (error) {
                        peerErrors.push(error);
                        throw error;
                    }
                } else {
                    this.receive("getMastersTransferCompleteAck", {
                        requestId: payload.requestId,
                        success: true
                    });
                }
            }
            return true;
        }
        disconnectNow() {
            this.connected = false;
            this.receive("disconnect", "fixture disconnect");
        }
        reconnect() {
            this.id = "connection-B";
            this.connected = true;
            this.receive("connect");
        }
    }

    const collections = [
        "getMastersGroups", "getMastersUnits", "getMastersLedgers",
        "getMastersStockGroups", "getMastersStocks", "getMastersGodowns",
        "getMastersCostCentres", "getMasters"
    ];
    const socket = new Socket();
    const observeLate = gate();
    const context = vm.createContext({
        console: quiet,
        Buffer,
        Date: options.manualFinalClock ? FinalClockDate : Date,
        setTimeout: timer,
        clearTimeout: clearTimer
    });
    vm.runInContext(`
        globalThis.global = globalThis;
        globalThis.process = Object.freeze({
            env: Object.freeze({ INTEGRITY_DEBUG: "false" })
        });
    `, context);

    queue = load(path.join(root, "src/tally/tallyRequestQueue.js"));
    const facade = load(path.join(root, "src/tally/tallyOperationQueue.js"));
    assert.equal(facade.withTallyOperationQueue, queue.withTallyOperationQueue);
    const service = load(path.join(root, "src/tally/tallyService.js"));
    const masters = load(path.join(root, "src/tally/importMasters.js"));
    const Controller = load(path.join(root, "utils/protocol/ConnectorProtocolController.js"));
    const tracker = load(path.join(root, "utils/syncTracker.js"));
    controller = new Controller(socket);

    if (options.chunkAck === "lost") {
        const originalWaitForReceived = controller.sender.waitForReceived;
        controller.sender.waitForReceived = function (
            collection, batchId, chunkIndex, requestId
        ) {
            const before = new Set(timerDetails.keys());
            const pending = originalWaitForReceived.call(
                this, collection, batchId, chunkIndex, requestId
            );
            const created = [...timerDetails.entries()].filter(
                ([id]) => !before.has(id)
            );
            assert.equal(created.length, 1, "waitForReceived must create exactly one timer");
            const [, detail] = created[0];
            assert.equal(detail.delay, 120000);
            detail.chunkAckIdentity = { collection, batchId, chunkIndex, requestId };
            return pending;
        };
    }

    Object.assign(context, {
        createHash: require("node:crypto").createHash,
        syncSocket: socket,
        syncProtocolController: controller,
        admitTallyRequest: queue.admitTallyRequest,
        runWithTallyExecution: queue.runWithTallyExecution,
        withTallyOperationQueue: facade.withTallyOperationQueue,
        runWithTallyMonitor: service.runWithTallyMonitor,
        importMasters: masters.importMasters,
        trackSyncEvent: tracker.trackSyncEvent
    });
    vm.runInContext(fingerprintSource + "\n" + handlerSource, context, {
        filename: handlerPath + ".integration"
    });
    const originalFinalAck = context.sendGetMastersTransferCompleteWithAck;
    context.sendGetMastersTransferCompleteWithAck = function (requestId, session) {
        const observation = { requestId, attempt: 0, settled: false, error: null };
        finalInvocations.push(observation);
        const pending = finalTimerStorage.run(
            observation, () => originalFinalAck(requestId, session)
        );
        pending.then(
            () => { observation.settled = true; },
            error => {
                observation.settled = true;
                observation.error = error;
            }
        );
        return pending;
    };
    const handlers = socket.listeners("getMasters");
    assert.equal(handlers.length, 1);
    const baselineListeners = new Map(
        socket.eventNames().map(event => [event, socket.rawListeners(event)])
    );

    function request(overrides = {}) {
        const data = {
            requestId: randomUUID(),
            batchId: randomUUID(),
            identityScope: "fixture-scope",
            companyIdentity: "guid:fixture-company-guid",
            payloadFingerprint: "sha256:" + "b".repeat(64),
            company: "Fixture Company",
            lastAlterId: "0",
            lastStockAlterId: "0",
            lastLedgerAlterId: "0",
            ...overrides
        };
        data.tallyInputFingerprint = context.getMastersPayloadFingerprint(data);
        return data;
    }

    return {
        queue, socket, controller, packets, httpCalls, gate, track, request,
        invoke(data) { return track(handlers[0](data)); },
        replaceSocket(replacement) { context.syncSocket = replacement; },
        assertPeerClean() {
            if (peerErrors.length) {
                throw new AggregateError(peerErrors, "Fake peer callback failed");
            }
        },
        finalFailure(requestId) {
            const observations = finalInvocations.filter(item => item.requestId === requestId);
            assert.equal(observations.length, 1);
            assert.equal(observations[0].settled, true);
            return observations[0].error?.message;
        },
        expireFinalAckTimeout(requestId, attempt) {
            assert.equal(options.manualFinalClock, true);
            const candidates = [...timerDetails.entries()].filter(([, detail]) =>
                detail.finalAckIdentity?.requestId === requestId &&
                detail.finalAckIdentity.attempt === attempt
            );
            assert.equal(candidates.length, 1);
            const [id, detail] = candidates[0];
            assert.ok(detail.delay > 0);
            clockNow += detail.delay;
            clearTimer(id);
            detail.callback(...detail.args);
            return detail.delay;
        },
        expireChunkAckTimeout(chunk) {
            assert.equal(socket.listenerCount("protocol:received"), 1);
            const candidates = [...timerDetails.entries()].filter(([, detail]) => {
                const identity = detail.chunkAckIdentity;
                return identity &&
                    identity.requestId === chunk.requestId &&
                    identity.collection === chunk.collection &&
                    identity.batchId === chunk.batchId &&
                    identity.chunkIndex === chunk.chunkIndex;
            });
            assert.equal(candidates.length, 1, "Expected exactly the matching CHUNK ACK timer");
            const [id, detail] = candidates[0];
            assert.equal(detail.delay, 120000);
            clearTimer(id);
            detail.callback(...detail.args);
        },
        record(data) {
            return queue.getTallyRequestIdentity(data.identityScope, data.requestId);
        },
        results(data) {
            return packets.filter(p =>
                p.event === "getMastersResult" &&
                p.payload.requestId === data.requestId
            ).map(p => p.payload);
        },
        companyCalls(data) {
            return httpCalls.filter(c =>
                c.identity.requestId === data.requestId &&
                /<SUBTYPE>\s*Company\s*<\/SUBTYPE>/i.test(c.xml)
            );
        },
        async assertReleased() {
            if (peerErrors.length) {
                throw new AggregateError(peerErrors, "Fake peer callback failed");
            }
            const status = queue.getTallyQueueStatus();
            assert.equal(status.pendingOperations, 0);
            assert.equal(status.runningOperations, 0);
            assert.equal(status.idle, true);
            assert.equal(queue.getTallyExecutionContext(), null);
            const events = new Set([
                ...baselineListeners.keys(), ...socket.eventNames()
            ]);
            for (const event of events) {
                assert.deepEqual(
                    socket.rawListeners(event),
                    baselineListeners.get(event) || [],
                    `Listener leak: ${String(event)}`
                );
            }
            assert.equal(controller.sender.masterReadyRegistrations.size, 0);
            assert.equal(controller.sender.masterReadyWaiters.size, 0);
            assert.equal(controller.sender.masterReadyBuffer.size, 0);
            assert.equal(controller.sender.masterReadyConsumed.size, 0);
            assert.equal(controller.sender.masterReadyListenerAttached, false);
            assert.equal(timers.size, 0);
            assert.equal(timerDetails.size, 0);
            assert.equal(Boolean(socket.tallyOperationActive), false);
assert.equal(Boolean(socket.tallyRequestActive), false);
assert.equal(socket.tallyRequestStartedAt ?? 0, 0);
            observeLate.resolve();
            if (lateContext) assert.equal(await lateContext, null);
        },
        async cleanup() {
            socket.disconnectNow();
            for (const item of gates) item.resolve();
            try {
                await bounded(Promise.allSettled(tasks), "cleanup", 1000);
            } finally {
                for (const id of [...timers]) clearTimer(id);
            }
        }
    };
}

function integration(name, body) {
    test(name, { timeout: 6000, concurrency: false }, async () => {
        let h;
        let bodyError;
        let cleanupError;
        try {
            await bounded(body(options => {
                assert.equal(h, undefined, "One harness per test");
                h = createHarness(options);
                return h;
            }), name);
        } catch (error) {
            bodyError = error;
        } finally {
            if (h) {
                try {
                    await h.cleanup();
                } catch (error) {
                    cleanupError = error;
                }
            }
        }
        if (bodyError && cleanupError) {
            throw new AggregateError(
                [bodyError, cleanupError], `${name}: body and cleanup failed`
            );
        }
        if (bodyError) throw bodyError;
        if (cleanupError) throw cleanupError;
    });
}

integration("success uses real execution, extraction, protocol and cleanup", async make => {
    const h = make();
    const data = h.request();
    await h.invoke(data);
    assert.equal(h.record(data).state, "CALLBACK_FINISHED");
    assert.equal(h.companyCalls(data).length, 1);
    assert.equal(h.packets.filter(p => p.event === "protocol:complete").length, 8);
    assert.equal(h.packets.filter(p => p.event === "getMastersTransferComplete").length, 1);
    assert.equal(h.results(data).filter(r => r.success === false).length, 0);
    await h.assertReleased();
});

integration("real admission rejects identical and conflicting retransmissions", async make => {
    let first = true;
    let started;
    let release;
    const h = make({
        async http() {
            if (first) {
                first = false;
                started.resolve();
                await release.promise;
            }
        }
    });
    started = h.gate();
    release = h.gate();
    const data = h.request();
    const pending = h.invoke(data);
    await started.promise;
    const executionId = h.record(data).executionId;
    await h.invoke({ ...data });
    await h.invoke(h.request({ ...data, lastLedgerAlterId: "1" }));
    assert.equal(h.record(data).state, "CALLBACK_RUNNING");
    assert.equal(h.record(data).executionId, executionId);
    assert.ok(h.results(data).some(r => r.error === "DUPLICATE_TALLY_REQUEST"));
    assert.ok(h.results(data).some(r => r.error === "TALLY_REQUEST_IDENTITY_CONFLICT"));
    release.resolve();
    await pending;
    await h.invoke({ ...data });
    assert.equal(h.companyCalls(data).length, 1);
    assert.equal(h.record(data).state, "CALLBACK_FINISHED");
    await h.assertReleased();
});

integration("fingerprint mismatch fails before real admission", async make => {
    const h = make();
    const data = h.request();
    data.tallyInputFingerprint = "sha256:" + "0".repeat(64);
    await h.invoke(data);
    assert.equal(h.record(data), null);
    assert.equal(h.httpCalls.length, 0);
    assert.ok(h.results(data).some(r => r.error === "GET_MASTERS_FINGERPRINT_MISMATCH"));
    await h.assertReleased();
});

integration("distinct requests preserve FIFO and separate execution contexts", async make => {
    let first = true;
    let started;
    let release;
    const h = make({
        async http() {
            if (first) {
                first = false;
                started.resolve();
                await release.promise;
            }
        }
    });
    started = h.gate();
    release = h.gate();
    const a = h.request();
    const b = h.request();
    const firstTask = h.invoke(a);
    await started.promise;
    const secondTask = h.invoke(b);
    assert.equal(h.record(b).state, "ADMITTED");
    assert.equal(h.queue.getTallyQueueStatus().pendingOperations, 1);
    assert.equal(h.httpCalls.some(c => c.identity.requestId === b.requestId), false);
    release.resolve();
    await Promise.all([firstTask, secondTask]);
    const ids = h.httpCalls.map(c => c.identity.requestId);
    const firstB = ids.indexOf(b.requestId);
    assert.ok(firstB > 0);
    assert.equal(ids.slice(firstB).includes(a.requestId), false);
    assert.notEqual(h.record(a).executionId, h.record(b).executionId);
    assert.equal(h.record(a).state, "CALLBACK_FINISHED");
    assert.equal(h.record(b).state, "CALLBACK_FINISHED");
    await h.assertReleased();
});

integration("queued disconnect preserves unclaimed admission and blocks revival", async make => {
    const h = make();
    const started = h.gate();
    const release = h.gate();
    const blocker = h.track(h.queue.withTallyOperationQueue(async () => {
        started.resolve();
        await release.promise;
    }));
    await started.promise;
    const data = h.request();
    const pending = h.invoke(data);
    assert.equal(h.record(data).state, "ADMITTED");
    h.socket.disconnectNow();
    h.socket.reconnect();
    release.resolve();
    await Promise.all([blocker, pending]);
    assert.equal(h.record(data).state, "ADMITTED");
    assert.equal(h.httpCalls.length, 0);
    assert.equal(h.results(data).length, 0);
    await h.invoke({ ...data });
    assert.ok(h.results(data).some(r => r.error === "DUPLICATE_TALLY_REQUEST"));
    assert.equal(h.httpCalls.length, 0);
    await h.assertReleased();
});

integration("disconnect during extraction does not release FIFO early", async make => {
    let first = true;
    let started;
    let release;
    const h = make({
        async http() {
            if (first) {
                first = false;
                started.resolve();
                await release.promise;
            }
        }
    });
    started = h.gate();
    release = h.gate();
    const data = h.request();
    const pending = h.invoke(data);
    await started.promise;
    h.socket.disconnectNow();
    h.socket.reconnect();
    let successorRan = false;
    const next = h.track(h.queue.withTallyOperationQueue(() => {
        successorRan = true;
        assert.equal(h.queue.getTallyExecutionContext(), null);
    }));
    assert.equal(successorRan, false);
    assert.equal(h.record(data).state, "CALLBACK_RUNNING");
    assert.equal(h.queue.getTallyQueueStatus().runningOperations, 1);
    release.resolve();
    await Promise.all([pending, next]);
    assert.equal(successorRan, true);
    assert.equal(h.record(data).state, "CALLBACK_FINISHED");
    assert.equal(h.results(data).length, 0);
    assert.equal(h.packets.some(p => p.event === "getMastersTransferComplete"), false);
    await h.assertReleased();
});

integration("extraction error retains duplicate protection and permits distinct work", async make => {
    let fail = true;
    const h = make({
        http() {
            if (fail) {
                fail = false;
                throw new Error("FIXTURE_TALLY_ERROR");
            }
        }
    });
    const failed = h.request();
    await h.invoke(failed);
    assert.equal(h.record(failed).state, "CALLBACK_ERROR");
    const before = h.httpCalls.length;
    await h.invoke({ ...failed });
    assert.equal(h.httpCalls.length, before);
    assert.ok(h.results(failed).some(r => r.error === "DUPLICATE_TALLY_REQUEST"));
    const next = h.request();
    await h.invoke(next);
    assert.equal(h.record(next).state, "CALLBACK_FINISHED");
    await h.assertReleased();
});

integration("transport failure does not rewrite successful extraction state", async make => {
    const h = make({ transferFailure: true });
    const data = h.request();
    await h.invoke(data);
    assert.equal(h.companyCalls(data).length, 1);
    assert.equal(h.packets.filter(p => p.event === "protocol:complete").length, 1);
    assert.equal(h.packets.filter(p => p.event === "protocol:chunk").length, 0);
    assert.equal(h.record(data).state, "CALLBACK_FINISHED");
    assert.ok(h.results(data).some(r =>
        r.error === "GET_MASTERS_TRANSFER_OUTCOME_UNKNOWN" &&
        r.outcomeUnknown === true
    ));
    assert.equal(h.packets.some(p => p.event === "getMastersTransferComplete"), false);
    const before = h.httpCalls.length;
    await h.invoke({ ...data });
    assert.equal(h.httpCalls.length, before);
    await h.assertReleased();
});

integration("real execution identity cannot be claimed twice", async make => {
    const h = make();
    const data = h.request();
    await h.invoke(data);
    const identity = h.record(data);
    let callbackRan = false;
    assert.throws(() => h.queue.runWithTallyExecution(
        { status: "ADMITTED", identity },
        () => { callbackRan = true; }
    ), /already claimed/);
    assert.equal(callbackRan, false);
    assert.equal(h.queue.getTallyExecutionIdentity(identity.executionId).state, "CALLBACK_FINISHED");
    await h.assertReleased();
});

test("fresh module graphs isolate registries and Connector epochs", async () => {
    const a = createHarness();
    const b = createHarness();
    try {
        const data = a.request();
        const identity = {
            scope: data.identityScope,
            requestId: data.requestId,
            operation: "getMasters",
            companyIdentity: data.companyIdentity,
            payloadFingerprint: data.payloadFingerprint
        };
        const first = a.queue.admitTallyRequest(identity);
        assert.equal(first.status, "ADMITTED");
        assert.equal(b.record(data), null);
        const second = b.queue.admitTallyRequest(identity);
        assert.equal(second.status, "ADMITTED");
        assert.notEqual(first.identity.connectorEpoch, second.identity.connectorEpoch);
    } finally {
        await Promise.all([a.cleanup(), b.cleanup()]);
    }
});

function outgoing(h, event, requestId) {
    return h.packets.filter(p =>
        p.direction === "out" &&
        p.event === event &&
        p.payload?.requestId === requestId
    );
}

function assertUnitChunk(h, data) {
    const chunks = outgoing(h, "protocol:chunk", data.requestId);
    assert.equal(chunks.length, 1);
    const chunk = chunks[0].payload;
    assert.equal(chunk.collection, "getMastersUnits");
    assert.equal(chunk.chunkIndex, 1);
    assert.equal(chunk.totalChunks, 1);
    assert.equal(chunk.data.length, 1);
    assert.equal(chunk.data[0].guid, "fixture-unit-guid");
    assert.equal(chunk.data[0].masterid, 1);
    assert.equal(chunk.data[0].alterid, 1);
    assert.equal(chunk.data[0].name, "PCS");
    assert.equal(h.httpCalls.filter(c =>
        c.identity.requestId === data.requestId &&
        /<SUBTYPE>\s*Unit\s*<\/SUBTYPE>/i.test(c.xml)
    ).length, 1);
    return chunk;
}

function assertUnitLifecycle(h, data, duplicate = false) {
    const chunk = assertUnitChunk(h, data);
    const lifecycle = h.packets.filter(p =>
        p.payload?.requestId === data.requestId &&
        (p.payload.collection === "getMastersUnits" ||
            p.event === "getMastersTransferComplete" ||
            p.event === "getMastersTransferCompleteAck")
    );
    const expected = [
        "in:protocol:ready", "out:protocol:chunk", "in:protocol:received"
    ];
    if (duplicate) expected.push("in:protocol:received");
    expected.push(
        "out:protocol:complete", "in:protocol:completed",
        "out:getMastersTransferComplete", "in:getMastersTransferCompleteAck"
    );
    assert.deepEqual(lifecycle.map(p => `${p.direction}:${p.event}`), expected);
    const complete = lifecycle.find(p =>
        p.direction === "out" && p.event === "protocol:complete"
    ).payload;
    assert.equal(complete.batchId, chunk.batchId);
    assert.equal(complete.totalChunks, 1);
    assert.equal(complete.totalItems, 1);
    for (const packet of lifecycle) {
        if (packet.event === "protocol:received" || packet.event === "protocol:completed") {
            assert.equal(packet.payload.batchId, chunk.batchId);
            assert.equal(packet.payload.success, true);
        }
    }
    assert.equal(outgoing(h, "getMastersTransferComplete", data.requestId).length, 1);
    assert.equal(h.record(data).state, "CALLBACK_FINISHED");
    assert.equal(h.results(data).some(r => r.success === false), false);
}

function assertChunkUncertainty(h, data) {
    assertUnitChunk(h, data);
    assert.equal(outgoing(h, "protocol:complete", data.requestId).filter(
        p => p.payload.collection === "getMastersUnits"
    ).length, 0);
    assert.equal(outgoing(h, "getMastersTransferComplete", data.requestId).length, 0);
    const failures = h.results(data).filter(r => r.success === false);
    assert.equal(failures.length, 1);
    assert.equal(failures[0].error, "GET_MASTERS_TRANSFER_OUTCOME_UNKNOWN");
    assert.equal(failures[0].outcomeUnknown, true);
    assert.equal(h.record(data).state, "CALLBACK_FINISHED");
}

integration("populated unit completes real CHUNK lifecycle", async make => {
    const h = make({ populatedUnit: true });
    const data = h.request();
    await h.invoke(data);
    assertUnitLifecycle(h, data);
    await h.assertReleased();
});

integration("rejected CHUNK ACK reports transfer uncertainty", async make => {
    const h = make({ populatedUnit: true, chunkAck: "reject" });
    const data = h.request();
    await h.invoke(data);
    assertChunkUncertainty(h, data);
    await h.assertReleased();
});

integration("lost CHUNK ACK executes real timeout and cleans up", async make => {
    let chunkSeen;
    const h = make({
        populatedUnit: true,
        chunkAck: "lost",
        onChunk() { chunkSeen.resolve(); }
    });
    chunkSeen = h.gate();
    const data = h.request();
    const pending = h.invoke(data);
    await chunkSeen.promise;
    const chunk = assertUnitChunk(h, data);
    assert.equal(h.record(data).state, "CALLBACK_FINISHED");
    assert.equal(h.queue.getTallyQueueStatus().idle, true);
    assert.equal(h.socket.listenerCount("protocol:received"), 1);
    h.expireChunkAckTimeout(chunk);
    assert.equal(h.socket.listenerCount("protocol:received"), 0);
    assert.equal(h.socket.listenerCount("protocol:error"), 0);
    await pending;
    assertChunkUncertainty(h, data);
    await h.assertReleased();
});

integration("duplicate CHUNK ACK does not advance twice", async make => {
    const h = make({ populatedUnit: true, chunkAck: "duplicate" });
    const data = h.request();
    await h.invoke(data);
    assertUnitLifecycle(h, data, true);
    await h.assertReleased();
});

function assertFinalStage(h, data) {
    assertUnitChunk(h, data);
    assert.equal(h.record(data).state, "CALLBACK_FINISHED");
    assert.equal(h.companyCalls(data).length, 1);
    assert.equal(h.queue.getTallyQueueStatus().idle, true);
    const completes = outgoing(h, "protocol:complete", data.requestId);
    assert.equal(completes.length, 8);
    assert.equal(new Set(completes.map(p => p.payload.collection)).size, 8);
    assert.equal(h.packets.filter(p =>
        p.direction === "in" && p.event === "protocol:completed" &&
        p.payload.requestId === data.requestId && p.payload.success === true
    ).length, 8);
    const firstFinal = h.packets.findIndex(p =>
        p.direction === "out" && p.event === "getMastersTransferComplete" &&
        p.payload.requestId === data.requestId
    );
    assert.ok(firstFinal >= 0);
    assert.equal(h.packets.slice(firstFinal + 1).some(p =>
        p.direction === "out" && p.payload?.requestId === data.requestId &&
        (p.event === "protocol:chunk" || p.event === "protocol:complete")
    ), false);
}

function assertFinalOutcome(h, data, {
    attempts, uncertain = false, report = true, cause
}) {
    h.assertPeerClean();
    assertFinalStage(h, data);
    const notifications = outgoing(h, "getMastersTransferComplete", data.requestId);
    assert.equal(notifications.length, attempts);
    for (const notification of notifications) {
        assert.equal(notification.payload.requestId, data.requestId);
        assert.equal(notification.payload.success, true);
        assert.equal(notification.socketId, "connection-A");
        assert.deepEqual(Object.keys(notification.payload).sort(), ["requestId", "success"]);
    }
    const failures = h.results(data).filter(result => result.success === false);
    if (uncertain && report) {
        assert.equal(failures.length, 1);
        assert.equal(failures[0].error, "GET_MASTERS_TRANSFER_OUTCOME_UNKNOWN");
        assert.equal(failures[0].outcomeUnknown, true);
    } else {
        assert.equal(failures.length, 0);
    }
    assert.equal(h.finalFailure(data.requestId), cause);
}

integration("rejected final ACK preserves extraction and reports uncertainty", async make => {
    const h = make({
        populatedUnit: true,
        manualFinalClock: true,
        onFinal({ socket, payload }) {
            socket.receive("getMastersTransferCompleteAck", {
                requestId: payload.requestId, success: false
            });
        }
    });
    const data = h.request();
    await h.invoke(data);
    assertFinalOutcome(h, data, {
        attempts: 1, uncertain: true, cause: "GET_MASTERS_COMPLETION_ACK_REJECTED"
    });
    await h.assertReleased();
});

integration("lost final ACK retries notification without repeating work", async make => {
    let firstSeen;
    let httpCountAtFirstFinal;
    let h;
    h = make({
        populatedUnit: true,
        manualFinalClock: true,
        onFinal({ socket, payload, attempt }) {
            if (attempt === 1) {
                httpCountAtFirstFinal = h.httpCalls.length;
                firstSeen.resolve();
                return;
            }
            socket.receive("getMastersTransferCompleteAck", {
                requestId: payload.requestId, success: true
            });
        }
    });
    firstSeen = h.gate();
    const data = h.request();
    const pending = h.invoke(data);
    await firstSeen.promise;
    h.assertPeerClean();
    assertFinalStage(h, data);
    assert.equal(h.socket.tallyOperationActive, true);
    assert.equal(h.socket.listenerCount("getMastersTransferCompleteAck"), 1);
    assert.equal(h.expireFinalAckTimeout(data.requestId, 1), finalAckPolicy.attemptMs);
    await pending;
    assert.equal(h.httpCalls.length, httpCountAtFirstFinal);
    assertFinalOutcome(h, data, { attempts: 2 });
    await h.assertReleased();
});

integration("final ACK deadline exhaustion reports uncertainty without replay", async make => {
    let notices;
    let h;
    let httpCountAtFirstFinal;
    h = make({
        populatedUnit: true,
        manualFinalClock: true,
        onFinal({ attempt }) {
            if (attempt === 1) httpCountAtFirstFinal = h.httpCalls.length;
            notices[attempt - 1]?.resolve();
        }
    });
    notices = Array.from({ length: expectedFinalAttempts }, () => h.gate());
    const data = h.request();
    const pending = h.invoke(data);
    let elapsed = 0;
    for (let attempt = 1; attempt <= expectedFinalAttempts; attempt++) {
        const event = await Promise.race([
            notices[attempt - 1].promise.then(() => "notification"),
            pending.then(() => "settled")
        ]);
        assert.equal(event, "notification", `Handler settled before attempt ${attempt}`);
        h.assertPeerClean();
        assertFinalStage(h, data);
        assert.equal(h.socket.tallyOperationActive, true);
        const expectedDelay = Math.min(
            finalAckPolicy.attemptMs, finalAckPolicy.deadlineMs - elapsed
        );
        const delay = h.expireFinalAckTimeout(data.requestId, attempt);
        assert.equal(delay, expectedDelay);
        elapsed += delay;
    }
    await pending;
    assert.equal(elapsed, finalAckPolicy.deadlineMs);
    assert.equal(h.httpCalls.length, httpCountAtFirstFinal);
    assertFinalOutcome(h, data, {
        attempts: expectedFinalAttempts, uncertain: true,
        cause: "GET_MASTERS_COMPLETION_ACK_UNCONFIRMED"
    });
    await h.assertReleased();
});

integration("wrong requestId final ACK is ignored before matching ACK", async make => {
    let wrongSeen;
    let httpCount;
    let h;
    h = make({
        populatedUnit: true,
        manualFinalClock: true,
        onFinal({ socket }) {
            httpCount = h.httpCalls.length;
            socket.receive("getMastersTransferCompleteAck", {
                requestId: "wrong-request", success: true
            });
            wrongSeen.resolve();
        }
    });
    wrongSeen = h.gate();
    const data = h.request();
    const pending = h.invoke(data);
    await wrongSeen.promise;
    h.assertPeerClean();
    assertFinalStage(h, data);
    assert.equal(h.socket.listenerCount("getMastersTransferCompleteAck"), 1);
    assert.equal(h.socket.tallyOperationActive, true);
    assert.equal(h.results(data).some(r => r.success === false), false);
    h.socket.receive("getMastersTransferCompleteAck", {
        requestId: data.requestId, success: true
    });
    await pending;
    assert.equal(h.httpCalls.length, httpCount);
    assertFinalOutcome(h, data, { attempts: 1 });
    await h.assertReleased();
});

integration("duplicate final ACK settles once after populated transfer", async make => {
    const h = make({
        populatedUnit: true,
        manualFinalClock: true,
        onFinal({ socket, payload }) {
            const ack = { requestId: payload.requestId, success: true };
            socket.receive("getMastersTransferCompleteAck", ack);
            socket.receive("getMastersTransferCompleteAck", { ...ack });
        }
    });
    const data = h.request();
    await h.invoke(data);
    assertFinalOutcome(h, data, { attempts: 1 });
    assert.equal(h.packets.filter(p =>
        p.direction === "in" && p.event === "getMastersTransferCompleteAck" &&
        p.payload.requestId === data.requestId
    ).length, 2);
    await h.assertReleased();
});

function finalSessionLoss(name, action) {
    integration(name, async make => {
        let seen;
        let h;
        let httpCount;
        h = make({
            populatedUnit: true,
            manualFinalClock: true,
            onFinal() {
                httpCount = h.httpCalls.length;
                seen.resolve();
            }
        });
        seen = h.gate();
        const data = h.request();
        const pending = h.invoke(data);
        await seen.promise;
        h.assertPeerClean();
        assertFinalStage(h, data);
        assert.equal(h.socket.tallyOperationActive, true);
        assert.equal(h.socket.listenerCount("getMastersTransferCompleteAck"), 1);
        const replacement = action(h, data);
        await pending;
        assert.equal(h.httpCalls.length, httpCount);
        assertFinalOutcome(h, data, {
            attempts: 1, uncertain: true, report: false,
            cause: "GET_MASTERS_COMPLETION_SOCKET_DISCONNECTED"
        });
        if (replacement) {
            assert.equal(replacement.packets.length, 0);
            assert.equal(replacement.socket.eventNames().length, 0);
        }
        await h.assertReleased();
    });
}

finalSessionLoss("disconnect during final ACK wait suppresses stale report", h => {
    h.socket.disconnectNow();
});

finalSessionLoss("reconnect and stale final ACK cannot revive original session", (h, data) => {
    h.socket.disconnectNow();
    h.socket.reconnect();
    h.socket.receive("getMastersTransferCompleteAck", {
        requestId: data.requestId, success: true
    });
});

finalSessionLoss("socket ID change rejects matching final ACK", (h, data) => {
    h.socket.id = "connection-B";
    h.socket.receive("getMastersTransferCompleteAck", {
        requestId: data.requestId, success: true
    });
});

finalSessionLoss("replacement socket with same ID cannot accept old final ACK", (h, data) => {
    const packets = [];
    const socket = new EventEmitter();
    socket.id = h.socket.id;
    socket.connected = true;
    socket.emit = function (event, payload) {
        packets.push({ event, payload });
        return EventEmitter.prototype.emit.call(this, event, payload);
    };
    h.replaceSocket(socket);
    h.socket.receive("getMastersTransferCompleteAck", {
        requestId: data.requestId, success: true
    });
    return { socket, packets };
});
