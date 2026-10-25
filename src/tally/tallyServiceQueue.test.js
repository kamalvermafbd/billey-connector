"use strict";

const assert = require("assert");

const axios = require("axios");

const {
    withTallyRequestQueue: R,
    withTallyOperationQueue: O
} = require("./tallyRequestQueue");

const sleep = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    let active = 0;
    let maxActive = 0;
    let calls = 0;

    const originalPost = axios.post;

    axios.post = async () => {
        active++;
        calls++;
        maxActive = Math.max(maxActive, active);

        try {
            await sleep(50);
            return { data: "<ENVELOPE><STATUS>1</STATUS></ENVELOPE>" };
        } finally {
            active--;
        }
    };

    try {
        // Load after installing the HTTP mock.
        const {
            sendToTally
        } = require("./tallyService");

        const runOperation = label =>
            O(async () => {
                await sendToTally(`<TEST>${label}_1</TEST>`);
                await sendToTally(`<TEST>${label}_2</TEST>`);
            });

        await Promise.all([
            runOperation("A"),
            runOperation("B")
        ]);

        assert.strictEqual(calls, 4);
        assert.strictEqual(maxActive, 1);

        console.log("HTTP MOCK CALLS:", calls);
        console.log("MAX HTTP CONCURRENCY:", maxActive);
        console.log("PASS: HTTP requests were serialized");
    } finally {
        axios.post = originalPost;
    }
}

main().catch(error => {
    console.error("FAIL:", error);
    process.exitCode = 1;
});
