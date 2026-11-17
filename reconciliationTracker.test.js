
"use strict";

const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

const {
    admitReconciliationExecution: admit,
    installReconciliationFence: installFence,
    getReconciliationExecutionSnapshot: snapshot
} = require("./src/reconciliations/reconciliationExecutionTracker");

function identity() {
    return {
        requestId: randomUUID(),
        attemptId: randomUUID(),
        executionId: randomUUID(),
        operationId: randomUUID(),
        operationOrdinal: 1
    };
}

function rejects(fn, code) {
    assert.throws(fn, err => err.message === code);
}

try {
    const first = identity();
    const queued = admit(first);

    assert.equal(snapshot().pending, 1);

    rejects(
        () => admit(first),
        "RECONCILE_EXECUTION_DUPLICATE_REQUEST"
    );

    console.log("PASS 1: Duplicate request rejected");

    const running = admit(identity());
    running.assertMayStart();
    running.assertNotFenced();

    assert.equal(snapshot().running, 1);

    console.log("PASS 2: Running execution tracked");

    const fenceId = randomUUID();
    installFence({ fenceId });

    assert.equal(snapshot().fenced, true);

    rejects(
        () => queued.assertMayStart(),
        "RECONCILE_EXECUTION_FENCED"
    );

    console.log("PASS 3: Queued execution blocked");

    rejects(
        () => running.assertNotFenced(),
        "RECONCILE_EXECUTION_FENCED"
    );

    console.log("PASS 4: Running execution detects fence");

    rejects(
        () => admit(identity()),
        "RECONCILE_EXECUTION_FENCED"
    );

    console.log("PASS 5: New admission blocked");

    assert.equal(
        installFence({ fenceId }).fenceId,
        fenceId
    );

    rejects(
        () => installFence({ fenceId: randomUUID() }),
        "RECONCILE_FENCE_CONFLICT"
    );

    console.log("PASS 6: Fence idempotency and conflict");

    queued.settle();
    running.settle();

    assert.equal(snapshot().pending, 0);
    assert.equal(snapshot().running, 0);
    assert.equal(snapshot().drained, true);

    console.log("PASS 7: Local executions settled");
    console.log("ALL 7 TESTS PASSED");

} catch (err) {
    console.error("TEST FAILED:", err);
    process.exitCode = 1;
}
