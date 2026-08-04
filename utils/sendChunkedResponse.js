const crypto = require("crypto");
const { buildChunks } = require("./ChunkBuilder");

const ACK_TIMEOUT = 30000;

const HEARTBEAT_INTERVAL = 5000;

async function waitForAck(socket, ackEvent, batchId, chunkIndex) {

    return new Promise((resolve, reject) => {

        const timeout = setTimeout(() => {

           
            socket.off(
                ackEvent,
                onAck
            );

            socket.off(
                "disconnect",
                onDisconnect
            );

            reject(
                new Error(
                    `ACK timeout for chunk ${chunkIndex}`
                )
            );

        }, ACK_TIMEOUT);

    function onAck(data) {


    console.log("CHUNK ACK RECEIVED");

    console.log(data);

        if (!data) {
            return;
        }

        console.log("ACK EVENT RECEIVED");
        console.log(data);

    if (
        data.batchId !== batchId ||
        data.chunkIndex !== chunkIndex
    ) {
        return;
    }

    clearTimeout(timeout);
    socket.off(ackEvent, onAck);

    socket.off(
        "disconnect",
        onDisconnect
    );

    if (data.success === false) {
        return reject(
        new Error(data.error || "Chunk rejected")
        );
    }

        resolve();

        
    }

function onDisconnect(reason) {

    clearTimeout(timeout);

    socket.off(
        ackEvent,
        onAck
    );

    socket.off(
        "disconnect",
        onDisconnect
    );

    reject(
        new Error(
            `Socket disconnected: ${reason}`
        )
    );

}


    socket.on(ackEvent, onAck);
    socket.once(
        "disconnect",
        onDisconnect
    );

    });

}

async function waitForCompleteAck(
    socket,
    completeAckEvent,
    batchId
) {

    return new Promise((resolve, reject) => {

        const timeout = setTimeout(() => {

            socket.off(
                completeAckEvent,
                onAck
            );

            socket.off(
                "disconnect",
                onDisconnect
            );

            reject(
                new Error(
                    "Collection complete ACK timeout"
                )
            );

        }, ACK_TIMEOUT);

        function onAck(data) {

             console.log("COMPLETE ACK RECEIVED");
             console.log(data);

            if (!data) {
                return;
            }

            if (data.batchId !== batchId) {
                return;
            }

            clearTimeout(timeout);

            socket.off(
                completeAckEvent,
                onAck
            );

            socket.off(
                "disconnect",
                onDisconnect
            );

            if (data.success === false) {

                return reject(
                    new Error(
                        data.error || "Collection rejected"
                    )
                );

            }

            resolve();

        }

        function onDisconnect(reason) {

            clearTimeout(timeout);

            socket.off(
                completeAckEvent,
                onAck
            );

            socket.off(
                "disconnect",
                onDisconnect
            );

            reject(
                new Error(
                    `Socket disconnected: ${reason}`
                )
            );

        }

        socket.on(
            completeAckEvent,
            onAck
        );

        socket.once(
            "disconnect",
            onDisconnect
        );

    });

}

async function sendChunkedResponse(
    socket,
    baseEvent,
    items,
    maxChunkSize
) {

    let heartbeat;

function startHeartbeat() {

    heartbeat = setInterval(() => {

    if (!socket.connected) {
        return;
    }

    socket.emit(`${baseEvent}Progress`, {
        batchId,
            timestamp: Date.now()
        });

    }, HEARTBEAT_INTERVAL);

    }

    function stopHeartbeat() {

        if (heartbeat) {

            clearInterval(heartbeat);

            heartbeat = null;

        }

    }

    const batchId = crypto.randomUUID();

    const chunks =
        buildChunks(items, maxChunkSize);

    if (chunks.length === 0) {

    console.log("No chunks to send");

    socket.emit(`${baseEvent}Complete`, {

        batchId,

        totalChunks: 0,

        totalItems: 0,

        completedAt: new Date().toISOString()

    });

    await waitForCompleteAck(

        socket,

        `${baseEvent}CompleteAck`,

        batchId

    );

    console.log("Empty collection completed");

    return;

}

    const chunkEvent =
        `${baseEvent}Chunk`;

    const ackEvent =
        `${baseEvent}ChunkAck`;

    const completeEvent =
        `${baseEvent}Complete`;

    const completeAckEvent =
    `${baseEvent}CompleteAck`;

    console.log(
        `Sending ${chunks.length} chunks`
    );

    startHeartbeat();

    try {
    for (const chunk of chunks) {

        if (!socket.connected) {

            throw new Error(
                    "Socket disconnected"
                );

        }

        console.log(
            `Sending chunk ${chunk.chunkIndex}/${chunk.totalChunks} (${chunk.payloadSize} bytes)`
        );

        socket.emit(chunkEvent, {

            batchId,

            chunkIndex:
                chunk.chunkIndex,

            totalChunks:
                chunk.totalChunks,

            payloadSize:
                chunk.payloadSize,

            data:
                chunk.data

        });

        console.log(
            `Chunk ${chunk.chunkIndex}/${chunk.totalChunks} sent`
        );

        await waitForAck(

            socket,

            ackEvent,

            batchId,

            chunk.chunkIndex

        );

        console.log(
            `ACK received for chunk ${chunk.chunkIndex}/${chunk.totalChunks}`
        );


    }

    console.log(
    "EMITTING COMPLETE:",
    completeEvent
);

console.log({
    batchId,
    totalChunks: chunks.length,
    totalItems: items.length
});

    socket.emit(
    completeEvent,
        {
            batchId,
            totalChunks: chunks.length,
            totalItems: items.length,
            completedAt: new Date().toISOString()
        }
    );

    await waitForCompleteAck(
        socket,
        completeAckEvent,
        batchId
    );

    console.log(
            "Complete event sent"
        );

    console.log(
        "Chunk transfer completed"
    );

    }
    finally {

        stopHeartbeat();

    }

}

module.exports = {

    sendChunkedResponse

};