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
    waitForTallyQueueIdle
};