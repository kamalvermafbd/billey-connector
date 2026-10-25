"use strict";

const assert = require("assert");

const {
    withTallyRequestQueue: R,
    withTallyOperationQueue: O
} = require("./tallyRequestQueue");

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function runTest(name, test) {
    process.stdout.write("\nTEST: " + name + "\n");
    await test();
    console.log("PASS:", name);
}

async function main() {

    await runTest("Concurrent operations remain serialized", async () => {
        let active = 0;
        let maxActive = 0;

        const request = label => R(async () => {
            active++;
            maxActive = Math.max(maxActive, active);

            try {
                await sleep(30);
            } finally {
                active--;
            }
        });

        await Promise.all([
            O(async () => {
                await request("A1");
                await request("A2");
            }),
            O(async () => {
                await request("B1");
                await request("B2");
            })
        ]);

        assert.strictEqual(maxActive, 1);
    });

    await runTest("Nested operation completes without deadlock", async () => {
        await O(async () => {
            await O(async () => {
                await R(async () => {
                    await sleep(20);
                });
            });
        });
    });

    await runTest("Queue recovers after request failure", async () => {
        let recovered = false;

        await O(async () => {
            await assert.rejects(
                R(async () => {
                    throw new Error("EXPECTED_TEST_FAILURE");
                }),
                /EXPECTED_TEST_FAILURE/
            );

            await R(async () => {
                recovered = true;
            });
        });

        assert.strictEqual(recovered, true);
    });

    console.log("\nALL QUEUE REGRESSION TESTS PASSED");
}

main().catch(error => {
    console.error("\nREGRESSION TEST FAILED");
    console.error(error);
    process.exitCode = 1;
});
