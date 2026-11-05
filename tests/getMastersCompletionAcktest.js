
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { EventEmitter } = require("node:events");

const sourcePath = path.resolve(
    __dirname,
    "../src/socket/secondSyncClientEvents.js"
);

const source = fs.readFileSync(sourcePath, "utf8");

const startMarker =
    "async function sendGetMastersTransferCompleteWithAck(requestId) {";

const endMarker =
    'syncSocket.on("getMasters", async (data) => {';

const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);

assert.ok(start >= 0, "ACK function not found");
assert.ok(end > start, "ACK function boundary not found");

const functionSource = source.slice(start, end);

function createHarness(onEmit) {
    class MockSocket extends EventEmitter {
        constructor() {
            super();
            this.connected = true;
            this.id = "mock-socket-1";
        }

        emit(event, payload) {
            if (event === "getMastersTransferComplete") {
                onEmit?.(this, payload);
                return true;
            }

            return super.emit(event, payload);
        }
    }

    const mockSocket = new MockSocket();

    const context = vm.createContext({
        syncSocket: mockSocket,
        console,
        Date,
        setTimeout,
        clearTimeout
    });

    
assert.ok(
    functionSource.includes("const ACK_TIMEOUT_MS = 5000;"),
    "Production ACK timeout constant changed"
);

assert.ok(
    functionSource.includes(
        "const ACK_RETRY_DEADLINE_MS = 120000;"
    ),
    "Production ACK retry deadline constant changed"
);

const testFunctionSource = functionSource
    .replace(
        "const ACK_TIMEOUT_MS = 5000;",
        "const ACK_TIMEOUT_MS = 20;"
    )
    .replace(
        "const ACK_RETRY_DEADLINE_MS = 120000;",
        "const ACK_RETRY_DEADLINE_MS = 200;"
    );


const sendAck = vm.runInContext(
    testFunctionSource +
    "\nsendGetMastersTransferCompleteWithAck;",
    context
);

    return { mockSocket, sendAck };
}

test("valid ACK confirms completion without retry", async () => {
    const requestId = "test-request-001";
    let emitCount = 0;

    const { mockSocket, sendAck } = createHarness(
        (socket, payload) => {
            emitCount++;

            assert.equal(payload.requestId, requestId);
            assert.equal(payload.success, true);

            queueMicrotask(() => {
                socket.emit("getMastersTransferCompleteAck", {
                    requestId,
                    success: true
                });
            });
        }
    );

    const result = await sendAck(requestId);

    assert.equal(result, true);
    assert.equal(emitCount, 1);

    assert.equal(
        mockSocket.listenerCount("getMastersTransferCompleteAck"),
        0
    );

    assert.equal(
        mockSocket.listenerCount("disconnect"),
        0
    );
});

test("negative ACK rejects without retry", async () => {
    const requestId = "test-request-negative-001";
    let emitCount = 0;

    const { mockSocket, sendAck } = createHarness(
        (socket) => {
            emitCount++;

            queueMicrotask(() => {
                socket.emit("getMastersTransferCompleteAck", {
                    requestId,
                    success: false
                });
            });
        }
    );

    await assert.rejects(
        sendAck(requestId),
        (error) => {
            assert.equal(
                error.message,
                "GET_MASTERS_COMPLETION_ACK_REJECTED"
            );
            return true;
        }
    );

    assert.equal(emitCount, 1);

    assert.equal(
        mockSocket.listenerCount("getMastersTransferCompleteAck"),
        0
    );

    assert.equal(
        mockSocket.listenerCount("disconnect"),
        0
    );
});


test("wrong requestId ACK is ignored", async () => {
    const requestId = "test-request-correct-001";
    let emitCount = 0;
    let wrongAckIgnored = false;

    const { mockSocket, sendAck } = createHarness(
        (socket) => {
            emitCount++;

            queueMicrotask(() => {
                socket.emit("getMastersTransferCompleteAck", {
                    requestId: "different-request-id",
                    success: true
                });

                wrongAckIgnored =
                    socket.listenerCount(
                        "getMastersTransferCompleteAck"
                    ) === 1;

                socket.emit("getMastersTransferCompleteAck", {
                    requestId,
                    success: true
                });
            });
        }
    );

    const result = await sendAck(requestId);

    assert.equal(wrongAckIgnored, true);
    assert.equal(result, true);
    assert.equal(emitCount, 1);

    assert.equal(
        mockSocket.listenerCount("getMastersTransferCompleteAck"),
        0
    );

    assert.equal(
        mockSocket.listenerCount("disconnect"),
        0
    );
});


test("lost ACK triggers retry and succeeds", async () => {
    const requestId = "test-request-retry-001";
    let emitCount = 0;

    const { mockSocket, sendAck } = createHarness(
        (socket, payload) => {
            emitCount++;

            assert.equal(payload.requestId, requestId);
            assert.equal(payload.success, true);

            // First completion event: ACK deliberately lost.
            if (emitCount === 1) {
                return;
            }

            // Second completion event: server ACK received.
            if (emitCount === 2) {
                queueMicrotask(() => {
                    socket.emit(
                        "getMastersTransferCompleteAck",
                        {
                            requestId,
                            success: true
                        }
                    );
                });
            }
        }
    );

    const result = await sendAck(requestId);

    assert.equal(result, true);
    assert.equal(emitCount, 2);

    assert.equal(
        mockSocket.listenerCount(
            "getMastersTransferCompleteAck"
        ),
        0
    );

    assert.equal(
        mockSocket.listenerCount("disconnect"),
        0
    );
});


test("socket disconnect during ACK wait fails closed", async () => {
    const requestId = "test-request-disconnect-001";
    let emitCount = 0;

    const { mockSocket, sendAck } = createHarness(
        (socket, payload) => {
            emitCount++;

            assert.equal(payload.requestId, requestId);
            assert.equal(payload.success, true);

            queueMicrotask(() => {
                socket.connected = false;
                socket.emit("disconnect", "transport close");
            });
        }
    );

    await assert.rejects(
        sendAck(requestId),
        (error) => {
            assert.equal(
                error.message,
                "GET_MASTERS_COMPLETION_SOCKET_DISCONNECTED"
            );
            return true;
        }
    );

    assert.equal(emitCount, 1);

    assert.equal(
        mockSocket.listenerCount(
            "getMastersTransferCompleteAck"
        ),
        0
    );

    assert.equal(
        mockSocket.listenerCount("disconnect"),
        0
    );
});


test("socket identity change rejects ACK", async () => {
    const requestId = "test-request-socket-change-001";
    let emitCount = 0;

    const { mockSocket, sendAck } = createHarness(
        (socket, payload) => {
            emitCount++;

            assert.equal(payload.requestId, requestId);
            assert.equal(payload.success, true);

            queueMicrotask(() => {
                // Simulate a different socket connection identity.
                socket.id = "mock-socket-2";

                // Old request receives a success ACK.
                socket.emit("getMastersTransferCompleteAck", {
                    requestId,
                    success: true
                });
            });
        }
    );

    await assert.rejects(
        sendAck(requestId),
        (error) => {
            assert.equal(
                error.message,
                "GET_MASTERS_COMPLETION_SOCKET_DISCONNECTED"
            );
            return true;
        }
    );

    assert.equal(emitCount, 1);

    assert.equal(
        mockSocket.listenerCount(
            "getMastersTransferCompleteAck"
        ),
        0
    );

    assert.equal(
        mockSocket.listenerCount("disconnect"),
        0
    );
});


test("ACK retry deadline exhaustion fails closed", async () => {
    const requestId = "test-request-deadline-001";
    let emitCount = 0;

    const { mockSocket, sendAck } = createHarness(
        (socket, payload) => {
            emitCount++;

            assert.equal(payload.requestId, requestId);
            assert.equal(payload.success, true);

            // Deliberately never send an ACK.
        }
    );

    await assert.rejects(
        sendAck(requestId),
        (error) => {
            assert.equal(
                error.message,
                "GET_MASTERS_COMPLETION_ACK_UNCONFIRMED"
            );
            return true;
        }
    );

    // At least one retry must have occurred.
    assert.ok(
        emitCount >= 2,
        `Expected retries, got ${emitCount} emits`
    );

    assert.equal(
        mockSocket.listenerCount(
            "getMastersTransferCompleteAck"
        ),
        0
    );

    assert.equal(
        mockSocket.listenerCount("disconnect"),
        0
    );
});


test("missing requestId rejects before emitting", async () => {
    let emitCount = 0;

    const { mockSocket, sendAck } = createHarness(
        () => {
            emitCount++;
        }
    );

    await assert.rejects(
        sendAck(""),
        (error) => {
            assert.equal(
                error.message,
                "GET_MASTERS_COMPLETION_REQUEST_ID_MISSING"
            );
            return true;
        }
    );

    assert.equal(emitCount, 0);

    assert.equal(
        mockSocket.listenerCount(
            "getMastersTransferCompleteAck"
        ),
        0
    );

    assert.equal(
        mockSocket.listenerCount("disconnect"),
        0
    );
});


test("completion emit failure rejects and cleans listeners", async () => {
    const requestId = "test-request-emit-error-001";
    let emitCount = 0;

    const { mockSocket, sendAck } = createHarness(
        () => {
            emitCount++;
            throw new Error("MOCK_SOCKET_EMIT_FAILED");
        }
    );

    await assert.rejects(
        sendAck(requestId),
        (error) => {
            assert.equal(
                error.message,
                "MOCK_SOCKET_EMIT_FAILED"
            );
            return true;
        }
    );

    assert.equal(emitCount, 1);

    assert.equal(
        mockSocket.listenerCount(
            "getMastersTransferCompleteAck"
        ),
        0
    );

    assert.equal(
        mockSocket.listenerCount("disconnect"),
        0
    );
});


test("ACK without success true is rejected", async () => {
    const requestId = "test-request-invalid-ack-001";
    let emitCount = 0;

    const { mockSocket, sendAck } = createHarness(
        (socket, payload) => {
            emitCount++;

            assert.equal(payload.requestId, requestId);

            queueMicrotask(() => {
                socket.emit("getMastersTransferCompleteAck", {
                    requestId
                    // success field intentionally missing
                });
            });
        }
    );

    await assert.rejects(
        sendAck(requestId),
        (error) => {
            assert.equal(
                error.message,
                "GET_MASTERS_COMPLETION_ACK_REJECTED"
            );
            return true;
        }
    );

    assert.equal(emitCount, 1);

    assert.equal(
        mockSocket.listenerCount(
            "getMastersTransferCompleteAck"
        ),
        0
    );

    assert.equal(
        mockSocket.listenerCount("disconnect"),
        0
    );
});


test("ACK received on disconnected socket is rejected", async () => {
    const requestId = "test-request-disconnected-ack-001";
    let emitCount = 0;

    const { mockSocket, sendAck } = createHarness(
        (socket, payload) => {
            emitCount++;

            assert.equal(payload.requestId, requestId);
            assert.equal(payload.success, true);

            queueMicrotask(() => {
                // Socket becomes disconnected without
                // emitting the disconnect event.
                socket.connected = false;

                socket.emit("getMastersTransferCompleteAck", {
                    requestId,
                    success: true
                });
            });
        }
    );

    await assert.rejects(
        sendAck(requestId),
        (error) => {
            assert.equal(
                error.message,
                "GET_MASTERS_COMPLETION_SOCKET_DISCONNECTED"
            );
            return true;
        }
    );

    assert.equal(emitCount, 1);

    assert.equal(
        mockSocket.listenerCount(
            "getMastersTransferCompleteAck"
        ),
        0
    );

    assert.equal(
        mockSocket.listenerCount("disconnect"),
        0
    );
});

test("already disconnected socket rejects before emit", async () => {
    const requestId = "test-request-pre-disconnected-001";
    let emitCount = 0;

    const { mockSocket, sendAck } = createHarness(
        () => {
            emitCount++;
        }
    );

    // Socket is already disconnected before function call.
    mockSocket.connected = false;

    await assert.rejects(
        sendAck(requestId),
        (error) => {
            assert.equal(
                error.message,
                "GET_MASTERS_COMPLETION_SOCKET_DISCONNECTED"
            );
            return true;
        }
    );

    assert.equal(emitCount, 0);

    assert.equal(
        mockSocket.listenerCount(
            "getMastersTransferCompleteAck"
        ),
        0
    );

    assert.equal(
        mockSocket.listenerCount("disconnect"),
        0
    );
});
