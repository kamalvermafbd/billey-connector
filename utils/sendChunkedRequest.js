const crypto = require("crypto");
const { buildChunks } = require("./ChunkBuilder");

async function waitForAck(
    socket,
    ackEvent,
    batchId,
    chunkIndex
) {

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

        }, 15 * 60 * 1000);

        function onAck(data) {

            if (
                !data ||
                data.batchId !== batchId ||
                data.chunkIndex !== chunkIndex
            ) {
                return;
            }

            clearTimeout(timeout);

            socket.off(
                ackEvent,
                onAck
            );

            socket.off(
                "disconnect",
                onDisconnect
            );

            if (data.success === false) {

                return reject(
                    new Error(
                        data.error ||
                        "Chunk rejected"
                    )
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

        socket.on(
            ackEvent,
            onAck
        );

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
                    "Complete ACK timeout"
                )
            );

        }, 15 * 60 * 1000);

        function onAck(data) {

            if (
                !data ||
                data.batchId !== batchId
            ) {
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
                        data.error ||
                        "Complete rejected"
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

async function sendChunkedRequest(
    socket,
    baseEvent,
    payload = {},
    items,
    maxChunkSize
) {

    const batchId = crypto.randomUUID();

    const chunks =
        buildChunks(items, maxChunkSize);

    const chunkEvent =
        `${baseEvent}Chunk`;

    const ackEvent =
        `${baseEvent}ChunkAck`;

    const completeEvent =
        `${baseEvent}Complete`;

    const completeAckEvent =
      `${baseEvent}CompleteAck`;

   console.log(
    `Sending ${chunks.length} request chunks`
);

    for (const chunk of chunks) {

        console.log(
    `Sending chunk ${chunk.chunkIndex}/${chunk.totalChunks} (${chunk.payloadSize} bytes)`
);

      socket.emit(
    chunkEvent,
    {

        batchId,

        ...payload,

        chunkIndex: chunk.chunkIndex,

        totalChunks: chunk.totalChunks,

        payloadSize: chunk.payloadSize,

        data: chunk.data

    }
);

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

 socket.emit(
    completeEvent,
    {
        batchId,

        ...payload,

        totalChunks:
            chunks.length,

        totalItems:
            items.length,

        completedAt:
            new Date().toISOString()

    }
);

await waitForCompleteAck(
    socket,
    completeAckEvent,
    batchId
);

console.log(
    "Request chunk transfer completed"
);

}

module.exports = {

    sendChunkedRequest

};