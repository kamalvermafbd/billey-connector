"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

function bounded(promise, label, milliseconds = 2000) {
    let timer;
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            timer = setTimeout(() => {
                reject(new Error(`Timeout: ${label}`));
            }, milliseconds);
        })
    ]).finally(() => clearTimeout(timer));
}

function harness() {
    // Fresh real modules isolate cases after a possible deadlock.
    const queuePath = require.resolve("../src/tally/tallyRequestQueue");
    const facadePath = require.resolve("../src/tally/tallyOperationQueue");
    const savedQueue = require.cache[queuePath];
    const savedFacade = require.cache[facadePath];
    let queue;
    let O;

    try {
        delete require.cache[queuePath];
        delete require.cache[facadePath];
        queue = require(queuePath);
        ({ withTallyOperationQueue: O } = require(facadePath));
    } finally {
        if (savedQueue) require.cache[queuePath] = savedQueue;
        else delete require.cache[queuePath];
        if (savedFacade) require.cache[facadePath] = savedFacade;
        else delete require.cache[facadePath];
    }

    assert.equal(O, queue.withTallyOperationQueue);
    const gates = [];
    const tasks = [];

    return {
        O,
        R: queue.withTallyRequestQueue,
        status: queue.getTallyQueueStatus,
        gate() {
            let resolve;
            const promise = new Promise(res => { resolve = res; });
            const gate = { promise, resolve };
            gates.push(gate);
            return gate;
        },
        track(promise) {
            promise.catch(() => {});
            tasks.push(promise);
            return promise;
        },
        async cleanup() {
            for (const gate of gates) gate.resolve();
            await bounded(Promise.allSettled(tasks), "cleanup", 1000);
        }
    };
}

function safetyTest(name, body) {
    test(name, { timeout: 5000, concurrency: false }, async () => {
        const h = harness();
        let bodyError;
        let cleanupError;

        try {
            await bounded(body(h), name);
        } catch (error) {
            bodyError = error;
        } finally {
            try {
                await h.cleanup();
            } catch (error) {
                cleanupError = error;
            }
        }

        if (bodyError && cleanupError) {
            throw new AggregateError(
                [bodyError, cleanupError],
                `${name}: body and cleanup failed`
            );
        }
        if (bodyError) throw bodyError;
        if (cleanupError) throw cleanupError;
    });
}

function assertStatus(h, pending, running) {
    const status = h.status();
    assert.equal(status.pendingOperations, pending);
    assert.equal(status.runningOperations, running);
    assert.equal(status.idle, pending === 0 && running === 0);
}

safetyTest("A: top-level operations are FIFO-exclusive", async h => {
    const started = h.gate();
    const release = h.gate();
    const order = [];
    let active = 0;
    let maxActive = 0;

    function operation(name, blocked = false) {
        return h.track(h.O(async () => {
            active++;
            maxActive = Math.max(maxActive, active);
            order.push(`${name}:start`);
            try {
                if (blocked) {
                    started.resolve();
                    await release.promise;
                }
            } finally {
                order.push(`${name}:end`);
                active--;
            }
        }));
    }

    const first = operation("A", true);
    await started.promise;
    const second = operation("B");
    const third = operation("C");
    assert.deepEqual(order, ["A:start"]);
    assertStatus(h, 2, 1);
    release.resolve();
    await Promise.all([first, second, third]);
    assert.deepEqual(order, [
        "A:start", "A:end", "B:start", "B:end", "C:start", "C:end"
    ]);
    assert.equal(maxActive, 1);
    assertStatus(h, 0, 0);
});

safetyTest("B: awaited O -> O -> O -> R completes", async h => {
    const order = [];
    const result = await h.track(h.O(async () => {
        order.push("outer");
        return h.O(async () => {
            order.push("middle");
            return h.O(async () => {
                order.push("inner");
                return h.R(() => {
                    order.push("request");
                    assertStatus(h, 0, 1);
                    return 42;
                });
            });
        });
    }));
    assert.equal(result, 42);
    assert.deepEqual(order, ["outer", "middle", "inner", "request"]);
    assertStatus(h, 0, 0);
});

safetyTest("C: sibling nested operations serialize R callbacks", async h => {
    const started = h.gate();
    const registered = h.gate();
    const release = h.gate();
    const order = [];
    let active = 0;
    let maxActive = 0;

    await h.track(h.O(async () => {
        const first = h.track(h.O(() => h.R(async () => {
            active++;
            maxActive = Math.max(maxActive, active);
            order.push("first:start");
            started.resolve();
            try {
                await release.promise;
            } finally {
                order.push("first:end");
                active--;
            }
        })));
        await started.promise;
        const second = h.track(h.O(async () => {
            const request = h.R(() => {
                active++;
                maxActive = Math.max(maxActive, active);
                try {
                    order.push("second");
                } finally {
                    active--;
                }
            });
            registered.resolve();
            await request;
        }));
        await registered.promise;
        assert.deepEqual(order, ["first:start"]);
        assertStatus(h, 0, 1);
        release.resolve();
        await Promise.all([first, second]);
    }));

    assert.equal(maxActive, 1);
    assert.deepEqual(order, ["first:start", "first:end", "second"]);
    assertStatus(h, 0, 0);
});

safetyTest("D: parent failure retains ownership until requests drain", async h => {
    const firstStarted = h.gate();
    const secondStarted = h.gate();
    const releaseFirst = h.gate();
    const releaseSecond = h.gate();
    const failure = new Error("parent failed");
    const order = [];
    let parentSettled = false;

    const parent = h.track(h.O(() => {
        h.track(h.R(async () => {
            order.push("request:1");
            firstStarted.resolve();
            await releaseFirst.promise;
        }));
        h.track(h.R(async () => {
            order.push("request:2");
            secondStarted.resolve();
            await releaseSecond.promise;
        }));
        throw failure;
    }));
    parent.then(
        () => { parentSettled = true; },
        () => { parentSettled = true; }
    );

    await firstStarted.promise;
    const next = h.track(h.O(() => { order.push("next"); }));
    assert.equal(parentSettled, false);
    assertStatus(h, 1, 1);
    releaseFirst.resolve();
    await secondStarted.promise;
    assert.equal(parentSettled, false);
    assert.deepEqual(order, ["request:1", "request:2"]);
    assertStatus(h, 1, 1);
    releaseSecond.resolve();
    await assert.rejects(parent, error => error === failure);
    await next;
    assert.deepEqual(order, ["request:1", "request:2", "next"]);
    assertStatus(h, 0, 0);
});

safetyTest("E: inactive ALS descendant joins the global queue", async h => {
    const releaseLate = h.gate();
    const lateRegistered = h.gate();
    const blockerStarted = h.gate();
    const releaseBlocker = h.gate();
    const order = [];
    let late;

    await h.track(h.O(() => {
        // Deliberate stale-context probe, not supported detached business work.
        late = h.track(releaseLate.promise.then(() => {
            const request = h.R(() => { order.push("late"); });
            lateRegistered.resolve();
            return request;
        }));
    }));
    assertStatus(h, 0, 0);

    const blocker = h.track(h.O(async () => {
        order.push("blocker:start");
        blockerStarted.resolve();
        await releaseBlocker.promise;
        order.push("blocker:end");
    }));
    await blockerStarted.promise;
    releaseLate.resolve();
    await lateRegistered.promise;
    assert.deepEqual(order, ["blocker:start"]);
    assertStatus(h, 1, 1);
    releaseBlocker.resolve();
    await Promise.all([blocker, late]);
    assert.deepEqual(order, ["blocker:start", "blocker:end", "late"]);
    assertStatus(h, 0, 0);
});

safetyTest("F: recursive R rejects and queue remains usable", async h => {
    let recursiveCallbackRan = false;
    await h.track(h.O(() => assert.rejects(
        h.R(() => h.R(() => { recursiveCallbackRan = true; })),
        /Nested withTallyRequestQueue calls are not supported/
    )));
    assert.equal(recursiveCallbackRan, false);
    const result = await h.track(h.O(() => h.R(() => "recovered")));
    assert.equal(result, "recovered");
    assertStatus(h, 0, 0);
});

safetyTest("G: counters return to idle after success and exceptions", async h => {
    assertStatus(h, 0, 0);
    await h.track(h.O(async () => {
        assertStatus(h, 0, 1);
        await h.O(() => h.R(() => assertStatus(h, 0, 1)));
    }));
    assertStatus(h, 0, 0);

    await assert.rejects(
        h.track(h.O(() => { throw new Error("operation error"); })),
        /operation error/
    );
    assertStatus(h, 0, 0);
    await assert.rejects(
        h.track(h.O(() => h.R(() => {
            throw new Error("request error");
        }))),
        /request error/
    );
    assertStatus(h, 0, 0);
    await assert.rejects(
        h.track(h.R(() => { throw new Error("direct request error"); })),
        /direct request error/
    );
    assertStatus(h, 0, 0);
});

safetyTest("H: rejected operation does not block queued successor", async h => {
    const started = h.gate();
    const release = h.gate();
    const order = [];
    const first = h.track(h.O(async () => {
        started.resolve();
        await release.promise;
        order.push("reject");
        throw new Error("expected rejection");
    }));
    await started.promise;
    const next = h.track(h.O(() => {
        order.push("next");
        return "ok";
    }));
    assertStatus(h, 1, 1);
    release.resolve();
    await assert.rejects(first, /expected rejection/);
    assert.equal(await next, "ok");
    assert.deepEqual(order, ["reject", "next"]);
    assertStatus(h, 0, 0);
});
