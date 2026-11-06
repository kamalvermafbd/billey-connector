"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { EventEmitter } = require("node:events");

const source = fs.readFileSync(
    path.resolve(
        __dirname,
        "../src/socket/secondSyncClientEvents.js"
    ),
    "utf8"
);

const startMarker =
    "const getMastersMonitoringRecords = new WeakMap();";

const endMarker =
    'syncSocket.on("getMastersVoucherGuids"';

const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);

assert.ok(start >= 0, "Monitoring source not found");
assert.ok(end > start, "Handler boundary not found");

const productionSource = source.slice(start, end);

assert.ok(
    productionSource.includes('syncSocket.on("getMasters"'),
    "Production getMasters handler not found"
);

function deferred() {
    let resolve;
    let reject;

    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });

    return { promise, resolve, reject };
}

function makeResult() {
    return {
        summary: {},
        groups: [],
        units: [],
        ledgers: [],
        stockGroups: [],
        stocks: [],
        godowns: [],
        costCentres: [],
        vouchers: [],
        voucherGuids: []
    };
}

function createHarness(options = {}) {
    const events = [];
    const calls = {
        admission: 0,
        queueEntered: 0,
        execution: 0,
        importMasters: 0,
        register: 0,
        unregister: 0,
        sendMasters: 0
    };

    class MockSocket extends EventEmitter {
        constructor() {
            super();
            this.id = "socket-original";
            this.connected = true;
            this.tallyOperationActive = false;
            this.tallyRequestActive = false;
            this.tallyRequestStartedAt = 0;
        }

        emit(event, payload) {
            events.push({ event, payload });
            return super.emit(event, payload);
        }

        disconnectNow() {
            this.connected = false;
            this.emit("disconnect", "test-disconnect");
        }

        reconnectSameId() {
            this.connected = true;
            this.emit("connect");
        }

        reconnectNewId() {
            this.id = "socket-reconnected";
            this.connected = true;
            this.emit("connect");
        }
    }

    const socket = new MockSocket();

    const controller = {
        registerMasterReady() {
            calls.register++;
        },

        unregisterMasterReady() {
            calls.unregister++;
        },

        async sendMasters(result, requestId, session) {
            calls.sendMasters++;

            if (options.sendMasters) {
                return options.sendMasters(
                    result,
                    requestId,
                    session
                );
            }

            session.assertCurrent();
            return true;
        }
    };

    const silentConsole = {
        log() {},
        warn() {},
        error() {}
    };

    const context = vm.createContext({
        syncSocket: socket,
        syncProtocolController: controller,

        console: silentConsole,
        Buffer,
        Date,
        setTimeout,
        clearTimeout,

        getMastersPayloadFingerprint() {
            return "sha256:" + "a".repeat(64);
        },

        admitTallyRequest(args) {
            calls.admission++;

            if (options.admit) {
                return options.admit(args);
            }

            return { status: "ADMITTED" };
        },

        async withTallyOperationQueue(operation) {
            calls.queueEntered++;

            if (options.queueGate) {
                await options.queueGate.promise;
            }

            return operation();
        },

        async runWithTallyExecution(admission, operation) {
            calls.execution++;
            return operation();
        },

        async runWithTallyMonitor(callbacks, operation) {
            if (options.monitorCallbacks) {
                options.monitorCallbacks(callbacks);
            }

            return operation();
        },

        async importMasters(args) {
            calls.importMasters++;

            if (options.importMasters) {
                return options.importMasters(args);
            }

            return makeResult();
        },

        trackSyncEvent() {}
    });

    vm.runInContext(productionSource, context, {
        filename: "secondSyncClientEvents.getMasters.vm.js"
    });

    const handlers = socket.listeners("getMasters");

    assert.equal(
        handlers.length,
        1,
        "Expected exactly one production getMasters handler"
    );

    const handler = handlers[0];

    function request(overrides = {}) {
        return {
            requestId: "test-request-001",
            batchId: "test-batch-001",
            company: "Test Company",
            lastAlterId: "0",
            lastStockAlterId: "0",
            lastLedgerAlterId: "0",
            ...overrides
        };
    }

    async function invoke(data = request()) {
        return handler(data);
    }

    function emitted(event) {
        return events
            .filter(entry => entry.event === event)
            .map(entry => entry.payload);
    }

    function results() {
        return emitted("getMastersResult");
    }

    function assertMonitoringIdle() {
        assert.equal(socket.tallyOperationActive, false);
        assert.equal(socket.tallyRequestActive, false);
        assert.equal(socket.tallyRequestStartedAt, 0);
    }

    return {
        socket,
        controller,
        events,
        calls,
        request,
        invoke,
        emitted,
        results,
        assertMonitoringIdle
    };
}

// ======================================================
// TEST 1 — DISCONNECT WHILE WAITING IN TALLY QUEUE
// ======================================================

test("queue-blocked disconnect prevents Tally execution", async () => {
    const queueGate = deferred();
    const h = createHarness({ queueGate });

    const pending = h.invoke();

    assert.equal(h.calls.queueEntered, 1);
    assert.equal(h.socket.tallyOperationActive, true);

    h.socket.disconnectNow();
    queueGate.resolve();

    await pending;

    assert.equal(h.calls.execution, 0);
    assert.equal(h.calls.importMasters, 0);
    assert.equal(h.calls.sendMasters, 0);
    assert.equal(h.results().length, 0);

    h.assertMonitoringIdle();
});

// ======================================================
// TEST 2 — RECONNECT DOES NOT REVIVE QUEUED OPERATION
// ======================================================

test("same-ID reconnect cannot revive queued operation", async () => {
    const queueGate = deferred();
    const h = createHarness({ queueGate });

    const pending = h.invoke();

    h.socket.disconnectNow();
    h.socket.reconnectSameId();

    queueGate.resolve();

    await pending;

    assert.equal(h.calls.importMasters, 0);
    assert.equal(h.calls.sendMasters, 0);
    assert.equal(h.results().length, 0);

    h.assertMonitoringIdle();
});

// ======================================================
// TEST 3 — DISCONNECT DURING TALLY EXTRACTION
// ======================================================

test("disconnect during extraction suppresses stale transfer", async () => {
    const extraction = deferred();

    const h = createHarness({
        importMasters: () => extraction.promise
    });

    const pending = h.invoke();

    // Allow queue and execution microtasks to run.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    assert.equal(h.calls.importMasters, 1);

    h.socket.disconnectNow();

    extraction.resolve(makeResult());

    await pending;

    assert.equal(h.calls.sendMasters, 0);
    assert.equal(h.calls.register, 0);
    assert.equal(h.results().length, 0);

    h.assertMonitoringIdle();
});

// ======================================================
// TEST 4 — EXTRACTION ERROR WHILE SESSION CURRENT
// ======================================================

test("Tally extraction error emits failure on current session", async () => {
    const h = createHarness({
        importMasters() {
            throw new Error("TEST_TALLY_EXTRACTION_FAILED");
        }
    });

    await h.invoke();

    const results = h.results();

    assert.equal(results.length, 1);
    assert.equal(results[0].success, false);
    assert.equal(
        results[0].error,
        "TEST_TALLY_EXTRACTION_FAILED"
    );

    assert.equal(h.calls.sendMasters, 0);
    h.assertMonitoringIdle();
});

// ======================================================
// TEST 5 — TRANSFER FAILURE AFTER TALLY EXECUTION
// ======================================================

test("transfer failure is classified as outcome unknown", async () => {
    const h = createHarness({
        sendMasters() {
            throw new Error("TEST_TRANSFER_FAILED");
        }
    });

    await h.invoke();

    assert.equal(h.calls.importMasters, 1);
    assert.equal(h.calls.register, 1);
    assert.equal(h.calls.sendMasters, 1);
    assert.equal(h.calls.unregister, 1);

    const results = h.results();

    assert.equal(results.length, 2);

    assert.equal(results[0].success, true);

    assert.equal(results[1].success, false);
    assert.equal(
        results[1].error,
        "GET_MASTERS_TRANSFER_OUTCOME_UNKNOWN"
    );
    assert.equal(results[1].outcomeUnknown, true);

    h.assertMonitoringIdle();
});

// ======================================================
// TEST 6 — DISCONNECT DURING TRANSFER
// ======================================================

test("disconnect during transfer suppresses stale failure response", async () => {
    const transfer = deferred();
    const transferStarted = deferred();

    const h = createHarness({
        sendMasters: () => {
            transferStarted.resolve();
            return transfer.promise;
        }
    });

    const pending = h.invoke();

    // Wait until production handler actually enters sendMasters().
    await transferStarted.promise;

    assert.equal(h.calls.sendMasters, 1);

    const countBeforeDisconnect = h.results().length;

    h.socket.disconnectNow();

    transfer.reject(
        new Error("TEST_TRANSFER_DISCONNECTED")
    );

    await pending;

    // Disconnected operation must not emit a stale result.
    assert.equal(
        h.results().length,
        countBeforeDisconnect
    );

    // READY registration must always be cleaned up.
    assert.equal(h.calls.unregister, 1);

    h.assertMonitoringIdle();
});

// ======================================================
// TEST 7 — DUPLICATE ADMISSION
// ======================================================

test("duplicate admission prevents Tally execution", async () => {
    const h = createHarness({
        admit() {
            return { status: "DUPLICATE" };
        }
    });

    await h.invoke();

    assert.equal(h.calls.admission, 1);
    assert.equal(h.calls.queueEntered, 0);
    assert.equal(h.calls.importMasters, 0);
    assert.equal(h.calls.sendMasters, 0);

    const results = h.results();

    assert.equal(results.length, 1);
    assert.equal(results[0].success, false);
    assert.equal(
        results[0].error,
        "DUPLICATE_TALLY_REQUEST"
    );

    h.assertMonitoringIdle();
});

// ======================================================
// TEST 8 — IDENTITY CONFLICT
// ======================================================

test("identity conflict prevents Tally execution", async () => {
    const h = createHarness({
        admit() {
            return { status: "IDENTITY_CONFLICT" };
        }
    });

    await h.invoke();

    assert.equal(h.calls.importMasters, 0);

    const results = h.results();

    assert.equal(results.length, 1);
    assert.equal(
        results[0].error,
        "TALLY_REQUEST_IDENTITY_CONFLICT"
    );

    h.assertMonitoringIdle();
});

// ======================================================
// TEST 9 — INVALID DURABLE IDENTITY
// ======================================================

test("invalid durable identity fails before admission", async () => {
    const h = createHarness();

    await h.invoke(
        h.request({
            identityScope: "company",
            companyIdentity: "invalid-company-identity"
        })
    );

    assert.equal(h.calls.admission, 0);
    assert.equal(h.calls.importMasters, 0);

    const results = h.results();

    assert.equal(results.length, 1);
    assert.equal(
        results[0].error,
        "INVALID_DURABLE_GET_MASTERS_IDENTITY"
    );

    h.assertMonitoringIdle();
});

// ======================================================
// TEST 10 — ADMISSION VALIDATION FAILURE
// ======================================================

test("admission exception fails closed before Tally execution", async () => {
    const h = createHarness({
        admit() {
            throw new Error("TEST_ADMISSION_FAILURE");
        }
    });

    await h.invoke();

    assert.equal(h.calls.importMasters, 0);
    assert.equal(h.calls.queueEntered, 0);

    const results = h.results();

    assert.equal(results.length, 1);
    assert.equal(
        results[0].error,
        "INVALID_GET_MASTERS_ADMISSION_IDENTITY"
    );

    h.assertMonitoringIdle();
});