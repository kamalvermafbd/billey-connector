
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const sourcePath = path.resolve(
    __dirname,
    "../src/socket/secondSyncClientEvents.js"
);

function createHarness(observe) {
    const source = fs.readFileSync(sourcePath, "utf8");

    const startMarker =
        'syncSocket.on("reconcile:observeExecution", (data = {}) => {';

    const endMarker =
        "// RECONCILE NOW — LEDGER OPENING";

    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start);

    assert.ok(start >= 0, "Observation handler not found");
    assert.ok(end > start, "Observation handler end not found");

    const section = source.slice(start, end);
    const handlers = new Map();
    const emitted = [];

    const syncSocket = {
        on(event, handler) {
            handlers.set(event, handler);
        },
        emit(event, payload) {
            emitted.push({ event, payload });
        }
    };

    vm.runInNewContext(
        `
        const RECONCILE_UUID =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        ${section}
        `,
        {
            syncSocket,
            getReconciliationExecutionObservation: observe
        },
        {
            filename: "reconcileObserveExecutionSocket.vm.js",
            timeout: 1000
        }
    );

    const handler = handlers.get("reconcile:observeExecution");
    assert.equal(typeof handler, "function");

    return { handler, emitted };
}

function request() {
    return {
        requestId: randomUUID(),
        attemptId: randomUUID(),
        executionId: randomUUID()
    };
}

test("invalid requestId is rejected before observation", () => {
    let called = false;

    const harness = createHarness(() => {
        called = true;
    });

    harness.handler({
        ...request(),
        requestId: "invalid"
    });

    assert.equal(called, false);
    assert.equal(harness.emitted.length, 0);
});

test("unknown execution stays locally unverified", () => {
    const harness = createHarness(({ attemptId, executionId }) => ({
        attemptId,
        executionId,
        executionKnown: false,
        locallyDrained: false,
        settlementEligible: false
    }));

    harness.handler(request());

    assert.equal(harness.emitted.length, 1);

    const result = harness.emitted[0];

    assert.equal(result.event, "reconcile:observeExecutionResult");
    assert.equal(result.payload.success, true);
    assert.equal(result.payload.observation.executionKnown, false);
    assert.equal(result.payload.observation.locallyDrained, false);
    assert.equal(result.payload.settlementEligible, false);
});

test("settled local execution never authorizes settlement", () => {
    const harness = createHarness(({ attemptId, executionId }) => ({
        attemptId,
        executionId,
        executionKnown: true,
        pending: 0,
        running: 0,
        settled: 1,
        locallyDrained: true,
        settlementEligible: false
    }));

    harness.handler(request());

    const result = harness.emitted[0];

    assert.equal(result.payload.success, true);
    assert.equal(result.payload.observation.locallyDrained, true);
    assert.equal(result.payload.observation.settlementEligible, false);
    assert.equal(result.payload.settlementEligible, false);
});

test("observation identity error returns failure ACK", () => {
    const harness = createHarness(() => {
        throw new Error("RECONCILE_OBSERVATION_IDENTITY_INVALID");
    });

    const input = request();
    harness.handler(input);

    assert.equal(harness.emitted.length, 1);

    const result = harness.emitted[0];

    assert.equal(result.payload.requestId, input.requestId);
    assert.equal(result.payload.success, false);
    assert.equal(
        result.payload.error,
        "RECONCILE_OBSERVATION_IDENTITY_INVALID"
    );
    assert.equal(result.payload.settlementEligible, false);
});
