const crypto = require("crypto");
const { buildChunks } = require("./ChunkBuilder");

async function waitForAck(socket, ackEvent, batchId, chunkIndex) {

    return new Promise((resolve, reject) => {

        const timeout = setTimeout(() => {

            socket.off(ackEvent, onAck);

            reject(
                new Error(
                    `ACK timeout for chunk ${chunkIndex}`
                )
            );

        }, 30000);

       function onAck(data) {

    if (
        data.batchId !== batchId ||
        data.chunkIndex !== chunkIndex
    ) {
        return;
    }

    clearTimeout(timeout);
    socket.off(ackEvent, onAck);

    if (data.success === false) {
        return reject(
            new Error(data.error || "Chunk rejected")
        );
    }

    resolve();
}

        socket.on(ackEvent, onAck);

    });

}

async function sendChunkedResponse(
    socket,
    baseEvent,
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

    console.log(
        `Sending ${chunks.length} chunks`
    );

    for (const chunk of chunks) {

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

    socket.emit(
    completeEvent,
    {
        batchId,
        totalChunks: chunks.length,
        totalItems: items.length,
        completedAt: new Date().toISOString()
    }
);

    console.log(
        "Chunk transfer completed"
    );

}

module.exports = {

    sendChunkedResponse

};