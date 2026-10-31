"use strict";

const { AsyncLocalStorage } = require("async_hooks");

const operationContext = new AsyncLocalStorage();

// Global FIFO queue for all Tally operations in this process.
let tail = Promise.resolve();
// Track all top-level Tally operations in this process.
let pendingOperations = 0;
let runningOperations = 0;

// Incremented whenever a new top-level operation is queued.
let operationGeneration = 0;
// ============================================
// Connector execution identity foundation
// Independent of the existing Tally FIFO.
// ============================================

const { randomUUID } = require("crypto");

const connectorEpoch = randomUUID();

const tallyExecutionContext = new AsyncLocalStorage();

const tallyRequestRegistry = new Map();

const tallyExecutionRegistry = new Map();

// Validate identifiers used for request admission.
function requireTallyIdentityString(value, fieldName) {
    if (
        typeof value !== "string" ||
        value.trim().length === 0
    ) {
        throw new TypeError(
            `${fieldName} must be a non-empty string`
        );
    }

    return value;
}

// Prevent collisions between different server/tenant scopes.
function getTallyRequestKey(scope, requestId) {
    return JSON.stringify([
        requireTallyIdentityString(scope, "scope"),
        requireTallyIdentityString(requestId, "requestId")
    ]);
}

// Return a read-only snapshot of an execution record.
// Never expose the mutable registry record directly.
function getTallyIdentitySnapshot(record) {
    return Object.freeze({
        connectorEpoch,
        executionId: record.executionId,
        requestId: record.requestId,
        scope: record.scope,
        operation: record.operation,
        companyIdentity: record.companyIdentity,
        payloadFingerprint: record.payloadFingerprint,
        protectedAgainstRetransmission:
            record.protectedAgainstRetransmission,
        state: record.state,
        retryable: false
    });
}

// Reserve a request identity before any asynchronous execution.
// This function never starts a Tally operation.
function admitTallyRequest(identity = {}) {
    const {
        scope,
        requestId,
        operation,
        companyIdentity,
        payloadFingerprint
    } = identity;

        // Nested Tally work must retain its parent execution identity.
    // Do not reserve another logical request inside an active execution.
    const currentExecution = getTallyExecutionContext();

    if (currentExecution) {
        return {
            status: "NESTED",
            identity: currentExecution
        };
    }

    const hasRequestId =
        requestId !== undefined &&
        requestId !== null &&
        requestId !== "";

    let requestKey = null;

    if (hasRequestId) {
        requestKey = getTallyRequestKey(scope, requestId);

        requireTallyIdentityString(operation, "operation");
        requireTallyIdentityString(
            companyIdentity,
            "companyIdentity"
        );
        requireTallyIdentityString(
            payloadFingerprint,
            "payloadFingerprint"
        );

        const existing = tallyRequestRegistry.get(requestKey);

        if (existing) {
            const sameRequest =
                existing.operation === operation &&
                existing.companyIdentity === companyIdentity &&
                existing.payloadFingerprint === payloadFingerprint;

            return {
                status: sameRequest
                    ? "DUPLICATE"
                    : "IDENTITY_CONFLICT",
                identity: getTallyIdentitySnapshot(existing)
            };
        }
    }

    const record = {
        executionId: randomUUID(),
        requestId: hasRequestId ? requestId : null,
        scope: hasRequestId ? scope : null,
        operation: operation ?? null,
        companyIdentity: companyIdentity ?? null,
        payloadFingerprint: payloadFingerprint ?? null,
        protectedAgainstRetransmission: hasRequestId,
        state: "ADMITTED",
        claimed: false
    };

    if (hasRequestId) {
        tallyRequestRegistry.set(requestKey, record);
    }

    tallyExecutionRegistry.set(record.executionId, record);

    return {
        status: hasRequestId
            ? "ADMITTED"
            : "LEGACY_UNPROTECTED",
        identity: getTallyIdentitySnapshot(record)
    };
}
// Find a previously admitted request by its stable identity.
function getTallyRequestIdentity(scope, requestId) {
    const requestKey = getTallyRequestKey(scope, requestId);
    const record = tallyRequestRegistry.get(requestKey);

    return record ? getTallyIdentitySnapshot(record) : null;
}

// Find an execution within the current connector process.
function getTallyExecutionIdentity(executionId) {
    const record = tallyExecutionRegistry.get(executionId);

    return record ? getTallyIdentitySnapshot(record) : null;
}

// Read the current execution identity without exposing mutable state.
function getTallyExecutionContext() {
    const context = tallyExecutionContext.getStore();

    if (!context || context.active !== true) {
        return null;
    }

    return getTallyIdentitySnapshot(context.record);
}

// Mark an active execution as having an explicitly observed
// ambiguous Tally transport outcome.
// This does not mean the Tally operation failed or completed.
function markTallyExecutionUnknown(reason) {
    const allowedReasons = [
        "TALLY_DISPATCH_OUTCOME_UNKNOWN",
        "TALLY_TRANSPORT_OUTCOME_UNKNOWN"
    ];

    if (!allowedReasons.includes(reason)) {
        throw new TypeError(
            "Unsupported ambiguous-outcome reason"
        );
    }

    const context = tallyExecutionContext.getStore();

    if (!context || context.active !== true) {
        throw new Error(
            "No active Tally execution identity"
        );
    }

    const record = context.record;

    if (
        record.state !== "CALLBACK_RUNNING" &&
        record.state !== "UNKNOWN"
    ) {
        throw new Error(
            "Execution is not active"
        );
    }

    record.state = "UNKNOWN";

    return getTallyIdentitySnapshot(record);
}
// Claim an admitted execution exactly once.
// Does not acquire the Tally FIFO or start any business operation.
function runWithTallyExecution(admission, callback) {
    if (typeof callback !== "function") {
        throw new TypeError("callback must be a function");
    }

    if (getTallyExecutionContext()) {
        throw new Error(
            "Nested executions must reuse the current identity"
        );
    }

    if (
        admission?.status !== "ADMITTED" &&
        admission?.status !== "LEGACY_UNPROTECTED"
    ) {
        throw new Error("Execution requires a new admission");
    }

    const record = tallyExecutionRegistry.get(
        admission.identity?.executionId
    );

    if (
        !record ||
        record.claimed ||
        record.state !== "ADMITTED"
    ) {
        throw new Error(
            "Execution is unavailable or already claimed"
        );
    }

    // Synchronous claim prevents duplicate callback execution.
    record.claimed = true;
    record.state = "CALLBACK_RUNNING";

    const context = {
        record,
        active: true
    };

    return tallyExecutionContext.run(context, async () => {
    try {
        const result = await callback();

        if (record.state !== "UNKNOWN") {
            record.state = "CALLBACK_FINISHED";
        }

        return result;
    } catch (error) {
        if (record.state !== "UNKNOWN") {
            record.state = "CALLBACK_ERROR";
        }

        throw error;
    } finally {
        context.active = false;
    }
});
}

function getTallyQueueStatus() {
    return {
        pendingOperations,
        runningOperations,
        idle:
            pendingOperations === 0 &&
            runningOperations === 0,
        operationGeneration
    };
}

async function waitForTallyQueueIdle() {
    // Capture the current queue tail.
    // Any operations queued afterwards are detected
    // by the generation and counter checks.
    const observedGeneration = operationGeneration;
    const observedTail = tail;

    await observedTail;

    const status = getTallyQueueStatus();

    return {
    ...status,
    verifiedIdle:
        status.idle &&
        status.operationGeneration === observedGeneration
};
}

function enqueue(operation) {
    pendingOperations++;
    operationGeneration++;

    const task = tail.then(async () => {
        pendingOperations--;
        runningOperations++;

        const context = {
            requestOnly: true,
            active: true,
            requestTail: Promise.resolve()
        };

        try {
            return await operationContext.run(
                context,
                async () => {
                    try {
                        return await operation();
                    } finally {
                        try {
                            await context.requestTail;
                        } finally {
                            context.active = false;
                        }
                    }
                }
            );
        } finally {
            runningOperations--;
        }
    });

    // Failed operations must not block the queue.
    tail = task.then(
        () => undefined,
        () => undefined
    );

    return task;
}
function withTallyRequestQueue(operation) {
    if (typeof operation !== "function") {
        throw new TypeError("operation must be a function");
    }

    const context = operationContext.getStore();

      // Nested request callbacks are not supported.
    // Allowing them to bypass the queue causes parallel execution.
    // Queuing them behind their own parent would cause a deadlock.
    if (
        context?.reentrantRequest === true &&
        context.active === true
    ) {
        return Promise.reject(
            new Error(
                "Nested withTallyRequestQueue calls are not supported"
            )
        );
    }
    let queueContext = null;

    if (
        context?.exclusive === true &&
        context.active === true
    ) {
        queueContext = context;
    } else if (
        context?.requestOnly === true &&
        context.active === true
    ) {
        queueContext = context;
    } else if (
        context?.parentContext?.active === true
    ) {
        queueContext = context.parentContext;
    }

    // No active context: enter global FIFO queue.
    if (!queueContext) {
        return enqueue(operation);
    }

    if (!queueContext.requestTail) {
        queueContext.requestTail = Promise.resolve();
    }

    // Serialize requests within the current operation.
    const task = queueContext.requestTail.then(() => {
        const requestContext = {
            exclusive: true,
            active: true,
            parentContext: queueContext,
            reentrantRequest: true
        };

        return operationContext.run(
            requestContext,
            async () => {
                try {
                    return await operation();
                } finally {
                    requestContext.active = false;
                }
            }
        );
    });

    queueContext.requestTail = task.then(
        () => undefined,
        () => undefined
    );

    return task;
}

function withTallyOperationQueue(operation) {
    if (typeof operation !== "function") {
        throw new TypeError("operation must be a function");
    }

    const context = operationContext.getStore();

    // Already inside a queued operation.
    // Reuse its exclusive ownership.
    if (
        context?.exclusive === true &&
        context.active === true
    ) {
        return operationContext.run(
            context,
            async () => await operation()
        );
    }

    // An operation invoked from an existing request
    // must not re-enter the global FIFO queue.
    if (
        context?.requestOnly === true &&
        context.active === true
    ) {
        const nestedContext = {
            exclusive: true,
            active: true,
            parentContext: context,
            requestTail: Promise.resolve()
        };

        return operationContext.run(
            nestedContext,
            async () => {
                try {
                    return await operation();
                } finally {
                    try {
                        await nestedContext.requestTail;
                    } finally {
                        nestedContext.active = false;
                    }
                }
            }
        );
    }

    // New operation enters global FIFO queue.
    return enqueue(async () => {
        const exclusiveContext = {
            exclusive: true,
            active: true,
            requestTail: Promise.resolve()
        };

        return operationContext.run(
            exclusiveContext,
            async () => {
                try {
                    return await operation();
                } finally {
                    try {
                        await exclusiveContext.requestTail;
                    } finally {
                        exclusiveContext.active = false;
                    }
                }
            }
        );
    });
}

module.exports = {
    withTallyRequestQueue,
    withTallyOperationQueue,
    getTallyQueueStatus,
    waitForTallyQueueIdle,

    // Execution identity and admission
    admitTallyRequest,
    runWithTallyExecution,
    getTallyRequestIdentity,
    getTallyExecutionIdentity,
    getTallyExecutionContext,
    markTallyExecutionUnknown
};