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

const sessionStartMarker =
    "function captureGetMastersSession() {";

const ackStartMarker =
    "async function sendGetMastersTransferCompleteWithAck(requestId, session) {";

const endMarker =
    'syncSocket.on("getMasters", async (data) => {';

const sessionStart = source.indexOf(sessionStartMarker);
const ackStart = source.indexOf(ackStartMarker);
const end = source.indexOf(endMarker, ackStart);

assert.ok(sessionStart >= 0, "Session capture function not found");
assert.ok(ackStart > sessionStart, "ACK function not found");
assert.ok(end > ackStart, "ACK function boundary not found");

const sessionFunctionSource = source.slice(
    sessionStart,
    ackStart
);

const ackFunctionSource = source.slice(
    ackStart,
    end
);

assert.ok(
    ackFunctionSource.includes("const ACK_TIMEOUT_MS = 5000;"),
    "Production ACK timeout constant changed"
);

assert.ok(
    ackFunctionSource.includes(
        "const ACK_RETRY_DEADLINE_MS = 120000;"
    ),
    "Production ACK retry deadline constant changed"
);

const testAckFunctionSource = ackFunctionSource
    .replace(
        "const ACK_TIMEOUT_MS = 5000;",
        "const ACK_TIMEOUT_MS = 20;"
    )
    .replace(
        "const ACK_RETRY_DEADLINE_MS = 120000;",
        "const ACK_RETRY_DEADLINE_MS = 200;"
    );

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

    const functions = vm.runInContext(
        sessionFunctionSource +
        "\n" +
        testAckFunctionSource +
        "\n({ captureGetMastersSession, sendGetMastersTransferCompleteWithAck });",
        context
    );

    const session = functions.captureGetMastersSession();

    async function sendAck(requestId) {
        try {
            return await functions.sendGetMastersTransferCompleteWithAck(
                requestId,
                session
            );
        } finally {
            session.dispose();
        }
    }

    function replaceSocket(replacement) {
        context.syncSocket = replacement;
    }

    return {
        mockSocket,
        sendAck,
        replaceSocket
    };
}

function assertNoListeners(socket) {
    assert.equal(
        socket.listenerCount("getMastersTransferCompleteAck"),
        0
    );

    assert.equal(
        socket.listenerCount("disconnect"),
        0
    );
}

async function assertAckError(promise, expectedError) {
    await assert.rejects(
        promise,
        (error) => {
            assert.equal(error.message, expectedError);
            return true;
        }
    );
}

// =====================================================
// TEST 1 — VALID ACK
// =====================================================

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
    assertNoListeners(mockSocket);
});

// =====================================================
// TEST 2 — NEGATIVE ACK
// =====================================================

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

    await assertAckError(
        sendAck(requestId),
        "GET_MASTERS_COMPLETION_ACK_REJECTED"
    );

    assert.equal(emitCount, 1);
    assertNoListeners(mockSocket);
});

// =====================================================
// TEST 3 — WRONG REQUEST ID
// =====================================================

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
    assertNoListeners(mockSocket);
});

// =====================================================
// TEST 4 — LOST ACK AND RETRY
// =====================================================

test("lost ACK triggers retry and succeeds", async () => {
    const requestId = "test-request-retry-001";
    let emitCount = 0;

    const { mockSocket, sendAck } = createHarness(
        (socket, payload) => {
            emitCount++;

            assert.equal(payload.requestId, requestId);
            assert.equal(payload.success, true);

            if (emitCount === 1) {
                return;
            }

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
    assertNoListeners(mockSocket);
});

// =====================================================
// TEST 5 — DISCONNECT DURING ACK WAIT
// =====================================================

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

    await assertAckError(
        sendAck(requestId),
        "GET_MASTERS_COMPLETION_SOCKET_DISCONNECTED"
    );

    assert.equal(emitCount, 1);
    assertNoListeners(mockSocket);
});

// =====================================================
// TEST 6 — SOCKET IDENTITY CHANGE
// =====================================================

test("socket identity change rejects ACK", async () => {
    const requestId = "test-request-socket-change-001";
    let emitCount = 0;

    const { mockSocket, sendAck } = createHarness(
        (socket, payload) => {
            emitCount++;

            assert.equal(payload.requestId, requestId);
            assert.equal(payload.success, true);

            queueMicrotask(() => {
                socket.id = "mock-socket-2";

                socket.emit("getMastersTransferCompleteAck", {
                    requestId,
                    success: true
                });
            });
        }
    );

    await assertAckError(
        sendAck(requestId),
        "GET_MASTERS_COMPLETION_SOCKET_DISCONNECTED"
    );

    assert.equal(emitCount, 1);
    assertNoListeners(mockSocket);
});

// =====================================================
// TEST 7 — RETRY DEADLINE EXHAUSTION
// =====================================================

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

    await assertAckError(
        sendAck(requestId),
        "GET_MASTERS_COMPLETION_ACK_UNCONFIRMED"
    );

    assert.ok(
        emitCount >= 2,
        `Expected retries, got ${emitCount} emits`
    );

    assertNoListeners(mockSocket);
});

// =====================================================
// TEST 8 — MISSING REQUEST ID
// =====================================================

test("missing requestId rejects before emitting", async () => {
    let emitCount = 0;

    const { mockSocket, sendAck } = createHarness(
        () => {
            emitCount++;
        }
    );

    await assertAckError(
        sendAck(""),
        "GET_MASTERS_COMPLETION_REQUEST_ID_MISSING"
    );

    assert.equal(emitCount, 0);
    assertNoListeners(mockSocket);
});

// =====================================================
// TEST 9 — SOCKET EMIT FAILURE
// =====================================================

test("completion emit failure rejects and cleans listeners", async () => {
    const requestId = "test-request-emit-error-001";
    let emitCount = 0;

    const { mockSocket, sendAck } = createHarness(
        () => {
            emitCount++;
            throw new Error("MOCK_SOCKET_EMIT_FAILED");
        }
    );

    await assertAckError(
        sendAck(requestId),
        "GET_MASTERS_COMPLETION_SOCKET_DISCONNECTED"
    );

    assert.equal(emitCount, 1);
    assertNoListeners(mockSocket);
});

// =====================================================
// TEST 10 — ACK WITHOUT SUCCESS TRUE
// =====================================================

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

    await assertAckError(
        sendAck(requestId),
        "GET_MASTERS_COMPLETION_ACK_REJECTED"
    );

    assert.equal(emitCount, 1);
    assertNoListeners(mockSocket);
});

// =====================================================
// TEST 11 — ACK ON DISCONNECTED SOCKET
// =====================================================

test("ACK received on disconnected socket is rejected", async () => {
    const requestId = "test-request-disconnected-ack-001";
    let emitCount = 0;

    const { mockSocket, sendAck } = createHarness(
        (socket, payload) => {
            emitCount++;

            assert.equal(payload.requestId, requestId);
            assert.equal(payload.success, true);

            queueMicrotask(() => {
                socket.connected = false;

                socket.emit("getMastersTransferCompleteAck", {
                    requestId,
                    success: true
                });
            });
        }
    );

    await assertAckError(
        sendAck(requestId),
        "GET_MASTERS_COMPLETION_SOCKET_DISCONNECTED"
    );

    assert.equal(emitCount, 1);
    assertNoListeners(mockSocket);
});

// =====================================================
// TEST 12 — ALREADY DISCONNECTED
// =====================================================

test("already disconnected socket rejects before emit", async () => {
    const requestId = "test-request-pre-disconnected-001";
    let emitCount = 0;

    const { mockSocket, sendAck } = createHarness(
        () => {
            emitCount++;
        }
    );

    mockSocket.connected = false;

    await assertAckError(
        sendAck(requestId),
        "GET_MASTERS_COMPLETION_SOCKET_DISCONNECTED"
    );

    assert.equal(emitCount, 0);
    assertNoListeners(mockSocket);
});

// =====================================================
// TEST 13 — DISCONNECT BEFORE HELPER, THEN RECONNECT
// =====================================================

test("disconnect before ACK helper rejects even after reconnect", async () => {
    let emitCount = 0;

    const { mockSocket, sendAck } = createHarness(
        () => {
            emitCount++;
        }
    );

    mockSocket.connected = false;
    mockSocket.emit("disconnect", "transport close");

    mockSocket.connected = true;
    mockSocket.id = "mock-socket-2";

    await assertAckError(
        sendAck("stale-request"),
        "GET_MASTERS_COMPLETION_SOCKET_DISCONNECTED"
    );

    assert.equal(emitCount, 0);
    assertNoListeners(mockSocket);
});

// =====================================================
// TEST 14 — REPLACEMENT SOCKET WITH SAME ID
// =====================================================

test("replacement socket with same id rejects old session", async () => {
    let emitCount = 0;

    const {
        mockSocket,
        sendAck,
        replaceSocket
    } = createHarness(
        () => {
            emitCount++;
        }
    );

    const replacement = new EventEmitter();

    replacement.connected = true;
    replacement.id = mockSocket.id;

    replaceSocket(replacement);

    await assertAckError(
        sendAck("replacement-request"),
        "GET_MASTERS_COMPLETION_SOCKET_DISCONNECTED"
    );

    assert.equal(emitCount, 0);
    assertNoListeners(mockSocket);
});

// =====================================================
// TEST 15 — DISCONNECT/RECONNECT WHILE ACK PENDING
// =====================================================

test("disconnect and reconnect while ACK pending fails closed", async () => {
    const requestId = "pending-reconnect-request";
    let emitCount = 0;

    const { mockSocket, sendAck } = createHarness(
        (socket) => {
            emitCount++;

            queueMicrotask(() => {
                socket.connected = false;
                socket.emit("disconnect", "transport close");

                socket.connected = true;
                socket.id = "mock-socket-2";

                socket.emit("getMastersTransferCompleteAck", {
                    requestId,
                    success: true
                });
            });
        }
    );

    await assertAckError(
        sendAck(requestId),
        "GET_MASTERS_COMPLETION_SOCKET_DISCONNECTED"
    );

    assert.equal(emitCount, 1);
    assertNoListeners(mockSocket);
});

// =====================================================
// TEST 16 — DUPLICATE SYNCHRONOUS POSITIVE ACK
// =====================================================

test("duplicate synchronous positive ACK settles once", async () => {
    const requestId = "duplicate-sync-ack";
    let emitCount = 0;

    const { mockSocket, sendAck } = createHarness(
        (socket) => {
            emitCount++;

            socket.emit("getMastersTransferCompleteAck", {
                requestId,
                success: true
            });

            socket.emit("getMastersTransferCompleteAck", {
                requestId,
                success: true
            });
        }
    );

    const result = await sendAck(requestId);

    assert.equal(result, true);
    assert.equal(emitCount, 1);
    assertNoListeners(mockSocket);
});