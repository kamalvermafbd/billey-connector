"use strict";

const { AsyncLocalStorage } = require("async_hooks");

const operationContext = new AsyncLocalStorage();

let tail = Promise.resolve();

function enqueue(operation) {
    const task = tail.then(async () => {
    const context = {
        requestOnly: true,
        active: true
    };

    return operationContext.run(context, async () => {
        try {
            return await operation();
        } finally {
            context.active = false;
        }
    });
});

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

    // Already inside an exclusive Tally operation.
    const context = operationContext.getStore();


const queueContext =
    context?.exclusive === true && context.active === true
        ? context
        : context?.requestOnly === true && context.active === true
            ? context
            : context?.parentContext?.active === true
                ? context.parentContext
                : null;


if (queueContext && !queueContext.requestTail) {
    queueContext.requestTail = Promise.resolve();
}

if (queueContext?.requestTail) {
   const task = queueContext.requestTail.then(() => {
    const requestContext = {
        exclusive: true,
        active: true,
        parentContext: queueContext,
        reentrantRequest: true
    };

    return operationContext.run(requestContext, async () => {
        try {
            return await operation();
        } finally {
            requestContext.active = false;
        }
    });
});

    queueContext.requestTail = task.then(
        () => undefined,
        () => undefined
    );

    return task;
}

    return enqueue(operation);
}
function withTallyOperationQueue(operation) {
    if (typeof operation !== "function") {
        throw new TypeError("operation must be a function");
    }
const context = operationContext.getStore();

// Avoid deadlock when operation is called
// from inside an already queued request.

if (context?.requestOnly === true && context.active === true) {
    const nestedContext = {
        exclusive: true,
        active: true,
        parentContext: context,
        requestTail: Promise.resolve()
    };

    return operationContext.run(nestedContext, async () => {
        try {
            return await operation();
        } finally {
            await nestedContext.requestTail;
            nestedContext.active = false;
        }
    });
}




if (context?.exclusive === true && context.active === true) {
    return operationContext.run(context, async () => {
        return await operation();
    });
}


    return enqueue(async () => {
        const context = {
            exclusive: true,
            active: true,
            requestTail: Promise.resolve()
        };

        return operationContext.run(context, async () => {
            try {
                return await operation();
           } finally {
    context.active = false;
    await context.requestTail;
}
        });
    });
}

module.exports = {
    withTallyRequestQueue,
    withTallyOperationQueue
};