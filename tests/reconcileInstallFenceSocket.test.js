
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

function createHarness() {
    const source = fs.readFileSync(sourcePath, "utf8");

    const startMarker =
        'syncSocket.on("reconcile:installFence", (data = {}) => {';

    const endMarker =
        '// MANUAL RECONCILIATION — EXECUTION OBSERVATION';

    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start);

    assert.ok(start >= 0, "Fence handler not found");
    assert.ok(end > start, "Fence handler end not found");

    const section = source.slice(start, end);

    const handlers = new Map();
    const emitted = [];
    const installed = [];

    let activeFence = null;
    let generation = 0;

    const syncSocket = {
        on(event, handler) {
            handlers.set(event, handler);
        },
        emit(event, payload) {
            emitted.push({ event, payload });
        }
    };

    function installReconciliationFence({ fenceId }) {
        installed.push(fenceId);

        if (
            activeFence !== null &&
            activeFence.toLowerCase() !== fenceId.toLowerCase()
        ) {
            throw new Error("RECONCILE_FENCE_CONFLICT");
        }

        if (activeFence === null) {
            activeFence = fenceId;
            generation++;
        }

        return {
            processEpoch: randomUUID(),
            generation,
            fenced: true,
            fenceId: activeFence,
            pending: 0,
            running: 0,
            drained: true
        };
    }

    vm.runInNewContext(
        `
        const RECONCILE_UUID =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        ${section}
        `,
        {
            syncSocket,
            installReconciliationFence
        },
        {
            filename: "reconcileInstallFenceSocket.vm.js",
            timeout: 1000
        }
    );

    const handler = handlers.get("reconcile:installFence");

    assert.equal(typeof handler, "function");

    return {
        handler,
        emitted,
        installed
    };
}

function validRequest() {
    return {
        requestId: randomUUID(),
        attemptId: randomUUID(),
        executionId: randomUUID(),
        fenceId: randomUUID()
    };
}

test("invalid attemptId does not install fence", () => {
    const harness = createHarness();

    harness.handler({
        ...validRequest(),
        attemptId: "invalid"
    });

    assert.equal(harness.installed.length, 0);
    assert.equal(harness.emitted.length, 0);
});

test("invalid executionId does not install fence", () => {
    const harness = createHarness();

    harness.handler({
        ...validRequest(),
        executionId: "invalid"
    });

    assert.equal(harness.installed.length, 0);
    assert.equal(harness.emitted.length, 0);
});

test("valid request installs fence and emits non-settling ACK", () => {
    const harness = createHarness();
    const request = validRequest();

    harness.handler(request);

    assert.deepEqual(harness.installed, [request.fenceId]);
    assert.equal(harness.emitted.length, 1);

    const result = harness.emitted[0];

    assert.equal(result.event, "reconcile:installFenceResult");
    assert.equal(result.payload.success, true);
    assert.equal(result.payload.requestId, request.requestId);
    assert.equal(result.payload.attemptId, request.attemptId);
    assert.equal(result.payload.executionId, request.executionId);
    assert.equal(result.payload.fenceId, request.fenceId);
    assert.equal(result.payload.snapshot.fenced, true);
    assert.equal(result.payload.settlementEligible, false);
});

test("conflicting fence emits failure ACK", () => {
    const harness = createHarness();
    const first = validRequest();

    harness.handler(first);

    const second = {
        ...validRequest(),
        fenceId: randomUUID()
    };

    harness.handler(second);

    assert.equal(harness.emitted.length, 2);

    const result = harness.emitted[1];

    assert.equal(result.event, "reconcile:installFenceResult");
    assert.equal(result.payload.success, false);
    assert.equal(
        result.payload.error,
        "RECONCILE_FENCE_CONFLICT"
    );
});
