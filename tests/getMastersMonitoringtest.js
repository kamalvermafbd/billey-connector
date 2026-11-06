"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const sourcePath = path.resolve(
    __dirname,
    "../src/socket/secondSyncClientEvents.js"
);

const source = fs.readFileSync(sourcePath, "utf8");

const startMarker =
    "const getMastersMonitoringRecords = new WeakMap();";

const endMarker =
    "function captureGetMastersSession() {";

const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);

assert.ok(
    start >= 0,
    "Production monitoring WeakMap not found"
);

assert.ok(
    end > start,
    "Production monitoring function boundary not found"
);

const monitoringSource = source.slice(start, end);

assert.ok(
    monitoringSource.includes(
        "function beginGetMastersMonitoring(session)"
    ),
    "Production monitoring function not found"
);

function createHarness() {
    let now = 1000;

    const context = vm.createContext({
        Date: {
            now: () => now
        }
    });

    const beginMonitoring = vm.runInContext(
        monitoringSource + "\nbeginGetMastersMonitoring;",
        context
    );

    function createSocket(id = "socket-1") {
        return {
            id,
            connected: true,
            tallyOperationActive: false,
            tallyRequestActive: false,
            tallyRequestStartedAt: 0,
            lastTallyActivity: 0
        };
    }

    function start(socket) {
        return beginMonitoring({ socket });
    }

    function setNow(value) {
        now = value;
    }

    return {
        createSocket,
        start,
        setNow
    };
}

function assertIdle(socket) {
    assert.equal(socket.tallyOperationActive, false);
    assert.equal(socket.tallyRequestActive, false);
    assert.equal(socket.tallyRequestStartedAt, 0);
}

function assertOperationActive(socket) {
    assert.equal(socket.tallyOperationActive, true);
}

// =====================================================
// TEST 1 — SINGLE OPERATION LIFECYCLE
// =====================================================

test("single operation sets and clears monitoring flags", () => {
    const h = createHarness();
    const socket = h.createSocket();

    const operation = h.start(socket);

    assertOperationActive(socket);
    assert.equal(socket.tallyRequestActive, false);
    assert.equal(socket.tallyRequestStartedAt, 0);
    assert.equal(socket.lastTallyActivity, 1000);

    h.setNow(1100);
    operation.requestStart();

    assertOperationActive(socket);
    assert.equal(socket.tallyRequestActive, true);
    assert.equal(socket.tallyRequestStartedAt, 1100);
    assert.equal(operation.requestStartedAt, 1100);
    assert.equal(socket.lastTallyActivity, 1100);

    h.setNow(1200);
    operation.requestEnd();

    assertOperationActive(socket);
    assert.equal(socket.tallyRequestActive, false);
    assert.equal(socket.tallyRequestStartedAt, 0);
    assert.equal(operation.requestStartedAt, 0);

    h.setNow(1300);
    operation.finish();

    assertIdle(socket);
    assert.equal(socket.lastTallyActivity, 1300);
});

// =====================================================
// TEST 2 — OLD FINISH MUST NOT CLEAR NEW OPERATION
// =====================================================

test("old operation finish cannot clear newer active operation", () => {
    const h = createHarness();
    const socket = h.createSocket();

    const oldOperation = h.start(socket);

    h.setNow(2000);
    const newOperation = h.start(socket);
    newOperation.requestStart();

    assert.equal(socket.tallyOperationActive, true);
    assert.equal(socket.tallyRequestActive, true);
    assert.equal(socket.tallyRequestStartedAt, 2000);

    h.setNow(2100);
    oldOperation.finish();

    assert.equal(socket.tallyOperationActive, true);
    assert.equal(socket.tallyRequestActive, true);
    assert.equal(socket.tallyRequestStartedAt, 2000);

    newOperation.finish();

    assertIdle(socket);
});

// =====================================================
// TEST 3 — EARLIEST ACTIVE REQUEST START TIME
// =====================================================

test("multiple active requests publish earliest start time", () => {
    const h = createHarness();
    const socket = h.createSocket();

    const first = h.start(socket);

    h.setNow(3000);
    first.requestStart();

    h.setNow(4000);
    const second = h.start(socket);
    second.requestStart();

    assert.equal(socket.tallyOperationActive, true);
    assert.equal(socket.tallyRequestActive, true);
    assert.equal(socket.tallyRequestStartedAt, 3000);

    h.setNow(5000);
    const third = h.start(socket);
    third.requestStart();

    assert.equal(socket.tallyRequestStartedAt, 3000);

    first.requestEnd();

    assert.equal(socket.tallyRequestActive, true);
    assert.equal(socket.tallyRequestStartedAt, 4000);

    second.requestEnd();

    assert.equal(socket.tallyRequestActive, true);
    assert.equal(socket.tallyRequestStartedAt, 5000);

    first.finish();
    second.finish();

    assert.equal(socket.tallyOperationActive, true);
    assert.equal(socket.tallyRequestActive, true);
    assert.equal(socket.tallyRequestStartedAt, 5000);

    third.finish();

    assertIdle(socket);
});

// =====================================================
// TEST 4 — INACTIVE OPERATION REMAINS REGISTERED
// =====================================================

test("requestEnd does not end the owning operation", () => {
    const h = createHarness();
    const socket = h.createSocket();

    const operation = h.start(socket);

    operation.requestStart();
    operation.requestEnd();

    assert.equal(socket.tallyOperationActive, true);
    assert.equal(socket.tallyRequestActive, false);
    assert.equal(socket.tallyRequestStartedAt, 0);

    operation.finish();

    assertIdle(socket);
});

// =====================================================
// TEST 5 — FINISH IS IDEMPOTENT
// =====================================================

test("duplicate finish cannot affect another active operation", () => {
    const h = createHarness();
    const socket = h.createSocket();

    const first = h.start(socket);
    const second = h.start(socket);

    second.requestStart();

    first.finish();
    first.finish();
    first.finish();

    assert.equal(socket.tallyOperationActive, true);
    assert.equal(socket.tallyRequestActive, true);
    assert.equal(
        socket.tallyRequestStartedAt,
        second.requestStartedAt
    );

    second.finish();
    second.finish();

    assertIdle(socket);
});

// =====================================================
// TEST 6 — LATE CALLBACKS AFTER FINISH
// =====================================================

test("late request callbacks after finish cannot revive flags", () => {
    const h = createHarness();
    const socket = h.createSocket();

    const operation = h.start(socket);

    operation.requestStart();
    operation.finish();

    assertIdle(socket);

    const activityAfterFinish = socket.lastTallyActivity;

    h.setNow(9000);

    operation.requestStart();
    operation.requestEnd();
    operation.finish();

    assertIdle(socket);
    assert.equal(operation.requestStartedAt, 0);
    assert.equal(
        socket.lastTallyActivity,
        activityAfterFinish
    );
});

// =====================================================
// TEST 7 — DIFFERENT SOCKETS ARE ISOLATED
// =====================================================

test("monitoring records are isolated per socket", () => {
    const h = createHarness();

    const socketA = h.createSocket("socket-A");
    const socketB = h.createSocket("socket-B");

    const operationA = h.start(socketA);

    h.setNow(2000);
    operationA.requestStart();

    h.setNow(3000);
    const operationB = h.start(socketB);
    operationB.requestStart();

    assert.equal(socketA.tallyRequestStartedAt, 2000);
    assert.equal(socketB.tallyRequestStartedAt, 3000);

    operationA.finish();

    assertIdle(socketA);

    assert.equal(socketB.tallyOperationActive, true);
    assert.equal(socketB.tallyRequestActive, true);
    assert.equal(socketB.tallyRequestStartedAt, 3000);

    operationB.finish();

    assertIdle(socketB);
});

// =====================================================
// TEST 8 — SAME SOCKET RECONNECT / NEW OPERATION
// =====================================================

test("old cleanup cannot clear new operation on reused socket", () => {
    const h = createHarness();
    const socket = h.createSocket();

    const oldOperation = h.start(socket);

    h.setNow(1000);
    oldOperation.requestStart();

    socket.connected = false;
    socket.id = "socket-reconnected";
    socket.connected = true;

    h.setNow(2000);
    const newOperation = h.start(socket);
    newOperation.requestStart();

    oldOperation.finish();

    assert.equal(socket.tallyOperationActive, true);
    assert.equal(socket.tallyRequestActive, true);
    assert.equal(socket.tallyRequestStartedAt, 2000);

    newOperation.finish();

    assertIdle(socket);
});

// =====================================================
// TEST 9 — ALL REQUESTS END BEFORE OPERATIONS FINISH
// =====================================================

test("operation flag remains active while registered operations exist", () => {
    const h = createHarness();
    const socket = h.createSocket();

    const first = h.start(socket);
    const second = h.start(socket);

    first.requestStart();
    second.requestStart();

    first.requestEnd();
    second.requestEnd();

    assert.equal(socket.tallyOperationActive, true);
    assert.equal(socket.tallyRequestActive, false);
    assert.equal(socket.tallyRequestStartedAt, 0);

    first.finish();

    assert.equal(socket.tallyOperationActive, true);
    assert.equal(socket.tallyRequestActive, false);

    second.finish();

    assertIdle(socket);
});

// =====================================================
// TEST 10 — FRESH OPERATION AFTER COMPLETE CLEANUP
// =====================================================

test("fresh monitoring works after previous records are deleted", () => {
    const h = createHarness();
    const socket = h.createSocket();

    const first = h.start(socket);

    first.requestStart();
    first.finish();

    assertIdle(socket);

    h.setNow(7000);

    const second = h.start(socket);

    assert.equal(socket.tallyOperationActive, true);
    assert.equal(socket.tallyRequestActive, false);

    second.requestStart();

    assert.equal(socket.tallyRequestActive, true);
    assert.equal(socket.tallyRequestStartedAt, 7000);

    second.finish();

    assertIdle(socket);
});