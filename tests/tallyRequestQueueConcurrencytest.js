"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
    withTallyOperationQueue
} = require("../src/tally/tallyRequestQueue");

function deferred() {
    let resolve;

    const promise = new Promise((res) => {
        resolve = res;
    });

    return { promise, resolve };
}

test("parallel nested Tally operations must not overlap", async () => {
    const firstStarted = deferred();
    const releaseFirst = deferred();

    let active = 0;
    let maxActive = 0;

    await withTallyOperationQueue(async () => {
        const first = withTallyOperationQueue(async () => {
            active++;
            maxActive = Math.max(maxActive, active);

            firstStarted.resolve();

            try {
                await releaseFirst.promise;
            } finally {
                active--;
            }
        });

        await firstStarted.promise;

        const second = withTallyOperationQueue(async () => {
            active++;
            maxActive = Math.max(maxActive, active);

            active--;
        });

        releaseFirst.resolve();

        await Promise.all([first, second]);
    });

    assert.equal(
        maxActive,
        1,
        "Parallel nested Tally operations overlapped"
    );
});