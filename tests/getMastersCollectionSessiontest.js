"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { EventEmitter } = require("node:events");

const senderPath = path.resolve(
    __dirname,
    "../utils/protocol/ConnectorProtocolSender.js"
);

const source = fs.readFileSync(senderPath, "utf8");

const start = source.indexOf(
    "class ConnectorProtocolSender {"
);

const end = source.indexOf(
    "module.exports =",
    start
);

assert.ok(start >= 0, "Sender class not found");
assert.ok(end > start, "Sender class boundary not found");

const senderSource = source.slice(start, end);

assert.ok(
    senderSource.includes("operationSession.assertCurrent()"),
    "Production session guard missing"
);

const EVENTS = {
    READY: "protocol:ready",
    CHUNK: "protocol:chunk",
    RECEIVED: "protocol:received",
    COMPLETE: "protocol:complete",
    COMPLETED: "protocol:completed",
    ERROR: "protocol:error"
};

class MockProtocolSession {
    constructor(socket) {
        this.socket = socket;
        this.finished = false;
        this.chunkCount = 0;
    }

    start(data) {
        this.data = data;
    }

    nextChunk() {
        this.chunkCount++;
    }

    finish() {
        this.finished = true;
    }
}

function buildChunks(items, maxChunkSize) {
    const size = maxChunkSize || 100;

    const chunks = [];

    for (let index = 0; index < items.length; index += size) {
        const data = items.slice(index, index + size);

        chunks.push({
            chunkIndex: chunks.length,
            totalChunks: Math.ceil(items.length / size),
            payloadSize: Buffer.byteLength(JSON.stringify(data)),
            data
        });
    }

    return chunks;
}

const context = vm.createContext({
    crypto: {
        randomUUID: () => "test-batch-id"
    },
    buildChunks,
    EVENTS,
    ConnectorProtocolSession: MockProtocolSession,
    console: {
        log() {},
        warn() {},
        error() {}
    },
    Buffer,
    setTimeout,
    clearTimeout
});

const ConnectorProtocolSender = vm.runInContext(
    senderSource + "\nConnectorProtocolSender;",
    context
);

class MockSocket extends EventEmitter {
    constructor() {
        super();

        this.connected = true;
        this.id = "socket-1";
        this.sent = [];
    }

    emit(event, payload) {
        if (
            event === EVENTS.CHUNK ||
            event === EVENTS.COMPLETE
        ) {
            this.sent.push({ event, payload });
        }

        return super.emit(event, payload);
    }

    disconnectNow() {
        this.connected = false;
        this.emit("disconnect", "transport close");
    }
}

function createHarness() {
    const socket = new MockSocket();
    const sender = new ConnectorProtocolSender(socket);

    const originalSocketId = socket.id;
    let disconnected = false;

    const onDisconnect = () => {
        disconnected = true;
    };

    socket.on("disconnect", onDisconnect);

    const operationSession = {
        socket,

        isCurrent() {
            return (
                !disconnected &&
                socket.connected === true &&
                socket.id === originalSocketId
            );
        },

        assertCurrent() {
            if (!this.isCurrent()) {
                throw new Error("GET_MASTERS_SESSION_LOST");
            }
        }
    };

    function dispose() {
        socket.off("disconnect", onDisconnect);
    }

    return {
        socket,
        sender,
        operationSession,
        dispose
    };
}

function registerReady(sender, requestId) {
    sender.registerMasterReady(requestId);
}

function emitReady(socket, requestId, collection) {
    socket.emit(EVENTS.READY, {
        requestId,
        collection,
        success: true
    });
}

function emitReceived(socket, payload) {
    socket.emit(EVENTS.RECEIVED, {
        collection: payload.collection,
        batchId: payload.batchId,
        chunkIndex: payload.chunkIndex,
        requestId: payload.requestId,
        success: true
    });
}

function emitCompleted(socket, payload) {
    socket.emit(EVENTS.COMPLETED, {
        collection: payload.collection,
        batchId: payload.batchId,
        requestId: payload.requestId,
        success: true
    });
}

async function expectSessionLost(promise) {
    await assert.rejects(
        promise,
        (error) => {
            assert.equal(
                error.message,
                "GET_MASTERS_SESSION_LOST"
            );

            return true;
        }
    );
}

// =====================================================
// TEST 1 — DISCONNECTED BEFORE TRANSFER
// =====================================================

test("disconnected session cannot start collection transfer", async () => {
    const h = createHarness();

    try {
        h.socket.disconnectNow();

        await expectSessionLost(
            h.sender.sendCollection(
                "getMastersGroups",
                [{ id: 1 }],
                1,
                "request-1",
                h.operationSession
            )
        );

        assert.equal(h.socket.sent.length, 0);
    } finally {
        h.dispose();
    }
});

// =====================================================
// TEST 2 — DISCONNECT AFTER READY
// =====================================================

test("disconnect after READY prevents CHUNK emission", async () => {
    const h = createHarness();
    const requestId = "request-2";
    const collection = "getMastersGroups";

    try {
        registerReady(h.sender, requestId);

        const transfer = h.sender.sendCollection(
            collection,
            [{ id: 1 }],
            1,
            requestId,
            h.operationSession
        );

        emitReady(h.socket, requestId, collection);

        h.socket.disconnectNow();

        await expectSessionLost(transfer);

        assert.equal(
            h.socket.sent.filter(
                (entry) => entry.event === EVENTS.CHUNK
            ).length,
            0
        );

        assert.equal(
            h.socket.sent.filter(
                (entry) => entry.event === EVENTS.COMPLETE
            ).length,
            0
        );
    } finally {
        h.sender.unregisterMasterReady(requestId);
        h.dispose();
    }
});

// =====================================================
// TEST 3 — DISCONNECT AFTER CHUNK ACK
// =====================================================

test("disconnect after CHUNK ACK prevents next CHUNK", async () => {
    const h = createHarness();
    const requestId = "request-3";
    const collection = "getMastersGroups";

    try {
        registerReady(h.sender, requestId);

        h.socket.on(EVENTS.CHUNK, (payload) => {
            if (payload.chunkIndex === 0) {
                emitReceived(h.socket, payload);
                h.socket.disconnectNow();
            }
        });

        emitReady(h.socket, requestId, collection);

        await expectSessionLost(
            h.sender.sendCollection(
                collection,
                [{ id: 1 }, { id: 2 }],
                1,
                requestId,
                h.operationSession
            )
        );

        const chunks = h.socket.sent.filter(
            (entry) => entry.event === EVENTS.CHUNK
        );

        assert.equal(chunks.length, 1);

        assert.equal(
            h.socket.sent.some(
                (entry) => entry.event === EVENTS.COMPLETE
            ),
            false
        );
    } finally {
        h.sender.unregisterMasterReady(requestId);
        h.dispose();
    }
});

// =====================================================
// TEST 4 — DISCONNECT BEFORE COMPLETE
// =====================================================

test("disconnect after final CHUNK ACK prevents COMPLETE", async () => {
    const h = createHarness();
    const requestId = "request-4";
    const collection = "getMastersGroups";

    try {
        registerReady(h.sender, requestId);

        h.socket.on(EVENTS.CHUNK, (payload) => {
            emitReceived(h.socket, payload);
            h.socket.disconnectNow();
        });

        emitReady(h.socket, requestId, collection);

        await expectSessionLost(
            h.sender.sendCollection(
                collection,
                [{ id: 1 }],
                1,
                requestId,
                h.operationSession
            )
        );

        assert.equal(
            h.socket.sent.filter(
                (entry) => entry.event === EVENTS.CHUNK
            ).length,
            1
        );

        assert.equal(
            h.socket.sent.some(
                (entry) => entry.event === EVENTS.COMPLETE
            ),
            false
        );
    } finally {
        h.sender.unregisterMasterReady(requestId);
        h.dispose();
    }
});

// =====================================================
// TEST 5 — SUCCESSFUL COLLECTION TRANSFER
// =====================================================

test("valid session completes collection transfer", async () => {
    const h = createHarness();
    const requestId = "request-5";
    const collection = "getMastersGroups";

    try {
        registerReady(h.sender, requestId);

        h.socket.on(EVENTS.CHUNK, (payload) => {
            emitReceived(h.socket, payload);
        });

        h.socket.on(EVENTS.COMPLETE, (payload) => {
            emitCompleted(h.socket, payload);
        });

        emitReady(h.socket, requestId, collection);

        const result = await h.sender.sendCollection(
            collection,
            [{ id: 1 }, { id: 2 }],
            1,
            requestId,
            h.operationSession
        );

        assert.equal(result, true);

        assert.equal(
            h.socket.sent.filter(
                (entry) => entry.event === EVENTS.CHUNK
            ).length,
            2
        );

        assert.equal(
            h.socket.sent.filter(
                (entry) => entry.event === EVENTS.COMPLETE
            ).length,
            1
        );
    } finally {
        h.sender.unregisterMasterReady(requestId);
        h.dispose();
    }
});

// =====================================================
// TEST 6 — SOCKET MISMATCH
// =====================================================

test("sender rejects session belonging to another socket", async () => {
    const h = createHarness();
    const otherSocket = new MockSocket();

    try {
        const wrongSession = {
            socket: otherSocket,

            assertCurrent() {
                return true;
            }
        };

        await assert.rejects(
            h.sender.sendCollection(
                "getMastersGroups",
                [{ id: 1 }],
                1,
                "request-6",
                wrongSession
            ),
            (error) => {
                assert.equal(
                    error.message,
                    "GET_MASTERS_SESSION_SOCKET_MISMATCH"
                );

                return true;
            }
        );

        assert.equal(h.socket.sent.length, 0);
    } finally {
        h.dispose();
    }
});

// =====================================================
// TEST 7 — RECONNECT CANNOT REVIVE OLD SESSION
// =====================================================

test("reconnect cannot revive disconnected operation session", async () => {
    const h = createHarness();

    try {
        h.socket.disconnectNow();

        h.socket.connected = true;
        h.socket.id = "socket-2";

        await expectSessionLost(
            h.sender.sendCollection(
                "getMastersGroups",
                [{ id: 1 }],
                1,
                "request-7",
                h.operationSession
            )
        );

        assert.equal(h.socket.sent.length, 0);
    } finally {
        h.dispose();
    }
});

// =====================================================
// TEST 8 — DISCONNECT DURING COMPLETED ACK
// =====================================================

test("disconnect during COMPLETED ACK fails closed", async () => {
    const h = createHarness();
    const requestId = "request-8";
    const collection = "getMastersGroups";

    try {
        registerReady(h.sender, requestId);

        h.socket.on(EVENTS.CHUNK, (payload) => {
            emitReceived(h.socket, payload);
        });

        h.socket.on(EVENTS.COMPLETE, (payload) => {
            emitCompleted(h.socket, payload);
            h.socket.disconnectNow();
        });

        emitReady(h.socket, requestId, collection);

        await expectSessionLost(
            h.sender.sendCollection(
                collection,
                [{ id: 1 }],
                1,
                requestId,
                h.operationSession
            )
        );

        assert.equal(
            h.socket.sent.filter(
                (entry) => entry.event === EVENTS.COMPLETE
            ).length,
            1
        );
    } finally {
        h.sender.unregisterMasterReady(requestId);
        h.dispose();
    }
});