
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

// Each scenario runs in a fresh Node process.
// The production tracker intentionally retains its fence
// and execution identities for the process lifetime.
const trackerPath = path.resolve(
    __dirname,
    "../src/reconciliations/reconciliationExecutionTracker.js"
);

function runIsolated(source) {
    const result = spawnSync(
        process.execPath,
        ["-e", `
            "use strict";
            const assert = require("node:assert/strict");
            const { randomUUID } = require("node:crypto");
            const tracker = require(${JSON.stringify(trackerPath)});
            function identity(overrides = {}) {
                return {
                    requestId: randomUUID(),
                    attemptId: randomUUID(),
                    executionId: randomUUID(),
                    operationId: randomUUID(),
                    operationOrdinal: 1,
                    ...overrides
                };
            }
            ${source}
        `],
        {
            encoding: "utf8",
            timeout: 5000
        }
    );

    assert.equal(
        result.status,
        0,
        `Isolated test failed:\n${result.stderr || result.stdout}`
    );
}

test("invalid execution identity is rejected", () => {
    runIsolated(`
        assert.throws(
            () => tracker.admitReconciliationExecution(
                identity({ attemptId: "invalid" })
            ),
            /RECONCILE_TRACKER_IDENTITY_INVALID/
        );

        assert.throws(
            () => tracker.admitReconciliationExecution(
                identity({ operationOrdinal: 0 })
            ),
            /RECONCILE_TRACKER_IDENTITY_INVALID/
        );

        assert.equal(
            tracker.getReconciliationExecutionSnapshot().generation,
            0
        );
    `);
});

test("duplicate requestId is rejected", () => {
    runIsolated(`
        const first = identity();

        tracker.admitReconciliationExecution(first);

        assert.throws(
            () => tracker.admitReconciliationExecution(
                identity({ requestId: first.requestId })
            ),
            /RECONCILE_EXECUTION_DUPLICATE_REQUEST/
        );
    `);
});

test("duplicate executionId is rejected", () => {
    runIsolated(`
        const first = identity();

        tracker.admitReconciliationExecution(first);

        assert.throws(
            () => tracker.admitReconciliationExecution(
                identity({ executionId: first.executionId })
            ),
            /RECONCILE_EXECUTION_DUPLICATE_IDENTITY/
        );
    `);
});

test("queued and running execution states are tracked", () => {
    runIsolated(`
        const ticket = tracker.admitReconciliationExecution(identity());

        let snapshot = tracker.getReconciliationExecutionSnapshot();

        assert.equal(snapshot.pending, 1);
        assert.equal(snapshot.running, 0);
        assert.equal(snapshot.drained, false);

        ticket.assertMayStart();

        snapshot = tracker.getReconciliationExecutionSnapshot();

        assert.equal(snapshot.pending, 0);
        assert.equal(snapshot.running, 1);

        ticket.settle();

        snapshot = tracker.getReconciliationExecutionSnapshot();

        assert.equal(snapshot.pending, 0);
        assert.equal(snapshot.running, 0);
        assert.equal(snapshot.drained, true);
    `);
});

test("fence blocks new execution admission", () => {
    runIsolated(`
        const fenceId = randomUUID();

       const snapshot = tracker.installReconciliationFence({
    fenceId,
    attemptId: randomUUID(),
    executionId: randomUUID()
});

        assert.equal(snapshot.fenced, true);
        assert.equal(snapshot.fenceId, fenceId);

        assert.throws(
            () => tracker.admitReconciliationExecution(identity()),
            /RECONCILE_EXECUTION_FENCED/
        );
    `);
});

test("fence blocks queued execution from starting", () => {
    runIsolated(`
        const ticket = tracker.admitReconciliationExecution(identity());

      tracker.installReconciliationFence({
    fenceId: randomUUID(),
    attemptId: ticket.identity.attemptId,
    executionId: ticket.identity.executionId
});

        assert.throws(
            () => ticket.assertMayStart(),
            /RECONCILE_EXECUTION_FENCED/
        );

        ticket.settle();
    `);
});

test("fence blocks running execution continuation", () => {
    runIsolated(`
        const ticket = tracker.admitReconciliationExecution(identity());

        ticket.assertMayStart();

        tracker.installReconciliationFence({
    fenceId: randomUUID(),
    attemptId: ticket.identity.attemptId,
    executionId: ticket.identity.executionId
});
        assert.throws(
            () => ticket.assertNotFenced(),
            /RECONCILE_EXECUTION_FENCED/
        );

        ticket.settle();
    `);
});

test("same fence is idempotent and conflicting fence rejected", () => {
    runIsolated(`
        const fenceId = randomUUID();
        const attemptId = randomUUID();
        const executionId = randomUUID();

        const first = tracker.installReconciliationFence({
            fenceId,
            attemptId,
            executionId
        });

        const second = tracker.installReconciliationFence({
            fenceId,
            attemptId,
            executionId
        });

        assert.equal(second.generation, first.generation);

        assert.throws(
            () => tracker.installReconciliationFence({
                fenceId: randomUUID(),
                attemptId,
                executionId
            }),
            /RECONCILE_FENCE_CONFLICT/
        );

        assert.equal(
            tracker.getReconciliationExecutionSnapshot().fenceId,
            fenceId
        );
    `);
});

test("unknown execution never reports locally drained", () => {
    runIsolated(`
       tracker.installReconciliationFence({
    fenceId: randomUUID(),
    attemptId: randomUUID(),
    executionId: randomUUID()
});

        const observation =
            tracker.getReconciliationExecutionObservation({
                attemptId: randomUUID(),
                executionId: randomUUID()
            });

        assert.equal(observation.executionKnown, false);
        assert.equal(observation.locallyDrained, false);
        assert.equal(observation.settlementEligible, false);
    `);
});

test("known settled execution is locally drained but not settlement eligible", () => {
    runIsolated(`
        const input = identity();

        const ticket = tracker.admitReconciliationExecution(input);

        ticket.assertMayStart();
        ticket.settle();

      tracker.installReconciliationFence({
    fenceId: randomUUID(),
    attemptId: input.attemptId,
    executionId: input.executionId
});

        const observation =
            tracker.getReconciliationExecutionObservation({
                attemptId: input.attemptId,
                executionId: input.executionId
            });

        assert.equal(observation.executionKnown, true);
        assert.equal(observation.pending, 0);
        assert.equal(observation.running, 0);
        assert.equal(observation.settled, 1);
        assert.equal(observation.locallyDrained, true);
        assert.equal(observation.settlementEligible, false);
    `);
});

test("invalid fence ID does not install a fence", () => {
    runIsolated(`
     assert.throws(
    () => tracker.installReconciliationFence({
        fenceId: "invalid",
        attemptId: randomUUID(),
        executionId: randomUUID()
    }),
    /RECONCILE_FENCE_IDENTITY_INVALID/
);

        const snapshot =
            tracker.getReconciliationExecutionSnapshot();

        assert.equal(snapshot.fenced, false);
        assert.equal(snapshot.generation, 0);
    `);
});

test("settled execution identity cannot be replayed", () => {
    runIsolated(`
        const input = identity();

        const ticket = tracker.admitReconciliationExecution(input);
        ticket.settle();

        assert.throws(
            () => tracker.admitReconciliationExecution(input),
            /RECONCILE_EXECUTION_DUPLICATE_REQUEST/
        );
    `);
});
test("unrelated execution identity must not establish recovery proof", () => {
    runIsolated(`
        const actual = identity();

        tracker.admitReconciliationExecution(actual);

        const unrelatedAttemptId = randomUUID();
        const unrelatedExecutionId = randomUUID();

        const before =
            tracker.getReconciliationExecutionObservation({
                attemptId: unrelatedAttemptId,
                executionId: unrelatedExecutionId
            });

        assert.equal(before.executionKnown, false);
        assert.equal(before.locallyDrained, false);

       tracker.installReconciliationFence({
    fenceId: randomUUID(),
    attemptId: unrelatedAttemptId,
    executionId: unrelatedExecutionId
});

        const after =
            tracker.getReconciliationExecutionObservation({
                attemptId: unrelatedAttemptId,
                executionId: unrelatedExecutionId
            });

        assert.equal(after.executionKnown, false);
        assert.equal(after.locallyDrained, false);
        assert.equal(after.settlementEligible, false);
    `);
});


test("unrelated identity currently installs process-wide fence", () => {
    runIsolated(`
        const actual = identity();

        tracker.admitReconciliationExecution(actual);

        const unrelatedAttemptId = randomUUID();
        const unrelatedExecutionId = randomUUID();
        const fenceId = randomUUID();

        const unrelated =
            tracker.getReconciliationExecutionObservation({
                attemptId: unrelatedAttemptId,
                executionId: unrelatedExecutionId
            });

        assert.equal(unrelated.executionKnown, false);

        const result =
            tracker.installReconciliationFence({
                fenceId,
                attemptId: unrelatedAttemptId,
                executionId: unrelatedExecutionId
            });

        assert.equal(result.fenced, true);
        assert.equal(result.fenceId, fenceId);
        assert.equal(result.pending, 1);
        assert.equal(result.drained, false);
    `);
});

test("partial execution identity collision is reported", () => {
    runIsolated(`
        const actual = identity();

        tracker.admitReconciliationExecution(actual);

        const result = tracker.installReconciliationFence({
            fenceId: randomUUID(),
            attemptId: actual.attemptId,
            executionId: randomUUID()
        });

        assert.equal(result.fenced, true);
        assert.equal(result.executionKnown, false);
        assert.equal(result.identityConflict, true);
        assert.equal(result.settlementEligible, false);
    `);
});

test("same fence ID cannot bind to different execution identity", () => {
    runIsolated(`
        const fenceId = randomUUID();
        const attemptId = randomUUID();
        const executionId = randomUUID();

        tracker.installReconciliationFence({
            fenceId,
            attemptId,
            executionId
        });

        assert.throws(
            () => tracker.installReconciliationFence({
                fenceId,
                attemptId,
                executionId: randomUUID()
            }),
            /RECONCILE_FENCE_CONFLICT/
        );

        const snapshot =
            tracker.getReconciliationExecutionSnapshot();

        assert.equal(snapshot.fenced, true);
        assert.equal(snapshot.fenceId, fenceId);
    `);
});