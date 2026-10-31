const crypto = require("crypto");

const {
    buildChunks
} = require("../ChunkBuilder");

const EVENTS =
    require("./ProtocolEvents");

const ConnectorProtocolSession =
    require("./ConnectorProtocolSession");

class ConnectorProtocolSender {

    constructor(socket) {

        this.socket = socket;

        this.session =
            new ConnectorProtocolSession(socket);

    }

    async waitForReady(collection, requestId) {

    return new Promise((resolve, reject) => {

        const event = EVENTS.READY;

        const cleanup = () => {
            clearTimeout(timeout);
            this.socket.off(event, onReady);
            this.socket.off("disconnect", onDisconnect);
        };

        const onReady = (data) => {

            if (
                !data ||
                data.collection !== collection ||
                !requestId ||
                data.requestId !== requestId
            ) {
                return;
            }

         cleanup();

if (data.success === false) {
    return reject(
        new Error(
            data.error || `Protocol READY rejected: ${collection}`
        )
    );
}

resolve(data);
        };

        const onDisconnect = () => {
            cleanup();
            reject(new Error("Socket disconnected"));
        };

        const timeout = setTimeout(() => {
            cleanup();

            reject(
                new Error(
                    `Protocol READY timeout: ${collection}, request ${requestId}`
                )
            );
        }, 120 * 1000);

        this.socket.on(event, onReady);
        this.socket.once("disconnect", onDisconnect);

    });

}

async waitForReceived(
    collection,
    batchId,
    chunkIndex,
    requestId
) {

    return new Promise((resolve, reject) => {

    const event =
    EVENTS.RECEIVED;

const ackTimeout = setTimeout(() => {

    this.socket.off(event, onReceived);

    this.socket.off(EVENTS.ERROR, onProtocolError);

    this.socket.off("disconnect", onDisconnect);

    reject(
        new Error(
            `Protocol ACK timeout: ${collection}, chunk ${chunkIndex}`
        )
    );

}, 120 * 1000);

const onProtocolError = (data) => {

    if (
        !data ||
        data.collection !== collection ||
        data.requestId !== requestId ||
        (data.batchId && data.batchId !== batchId)
    ) {
        return;
    }

    clearTimeout(ackTimeout);

    this.socket.off(event, onReceived);
    this.socket.off(EVENTS.ERROR, onProtocolError);
    this.socket.off("disconnect", onDisconnect);

    reject(
        new Error(
            data.error || "Protocol chunk rejected by server"
        )
    );

};

const onReceived = (data) => {
    if (!data) {
        return;
    }
            if (data.collection !== collection) {
                return;
            }

           if (
    data.batchId !== batchId ||
    data.chunkIndex !== chunkIndex ||
    !requestId ||
    data.requestId !== requestId
) {
    return;
}

          this.socket.off(
    event,
    onReceived
);

this.socket.off(
    EVENTS.ERROR,
    onProtocolError
);

this.socket.off(
    "disconnect",
    onDisconnect
);

clearTimeout(ackTimeout);

if (data.success === false) {
    return reject(
        new Error(
            data.error || "Protocol chunk rejected by server"
        )
    );
}

console.log(
    "✅ CONNECTOR RECEIVED ACK:",
    collection,
    batchId,
    chunkIndex
);

resolve();

        };

        const onDisconnect = () => {

    clearTimeout(ackTimeout);

    this.socket.off(
        event,
        onReceived
    );

    this.socket.off(
        EVENTS.ERROR,
        onProtocolError
    );

    this.socket.off(
        "disconnect",
        onDisconnect
    );

    reject(
        new Error(
            "Socket disconnected"
        )
    );

};
        this.socket.on(
    event,
    onReceived
);
//
this.socket.on(
    EVENTS.ERROR,
    onProtocolError
);

this.socket.once(
    "disconnect",
    onDisconnect
);
    });

}
async waitForCompleted(collection, batchId, requestId) {

    return new Promise((resolve, reject) => {

        const event = EVENTS.COMPLETED;

        const cleanup = () => {
            clearTimeout(timeout);
            this.socket.off(event, onCompleted);
            this.socket.off("disconnect", onDisconnect);
        };

        const onCompleted = (data) => {

            if (
                !data ||
                data.collection !== collection ||
                data.batchId !== batchId ||
                !requestId ||
                data.requestId !== requestId
            ) {
                return;
            }

            cleanup();

           if (data.success !== true) {
    return reject(
        new Error(
            data.error || `Protocol collection completion not confirmed: ${collection}`
        )
    );
}

resolve();
        };

        const onDisconnect = () => {
            cleanup();
            reject(new Error("Socket disconnected"));
        };

        const timeout = setTimeout(() => {
            cleanup();

            reject(
                new Error(
                    `Protocol COMPLETED timeout: ${collection}, batch ${batchId}`
                )
            );
        }, 120 * 1000);

        this.socket.on(event, onCompleted);
        this.socket.once("disconnect", onDisconnect);

    });

}

createSession(
    collection,
    items,
    maxChunkSize
) {

    const batchId =
        crypto.randomUUID();

    const chunks =
        buildChunks(
            items,
            maxChunkSize
        );

    this.session.start({

        collection,

        batchId,

        items,

        totalChunks:
            chunks.length

    });

    return {

        batchId,

        chunks

    };

}


async sendCollection(
    collection,
    items,
    maxChunkSize,
    requestId
) {

    if (!requestId) {
        throw new Error(
            "Protocol sendCollection requires requestId"
        );
    }

    await this.waitForReady(
        collection,
        requestId
    );

   try {

    const {

        batchId,

        chunks

    } = this.createSession(

        collection,

        items,

        maxChunkSize

    );
    console.log(
        `Starting ${collection}`
    );

    console.log(
        `Chunks : ${chunks.length}`
    );

    if (chunks.length === 0) {

    console.log(
        "ZERO CHUNK COLLECTION"
    );

}

        for (const chunk of chunks) {

            console.log(
    "📤 CONNECTOR SENDING CHUNK:",
    collection,
    batchId,
    chunk.chunkIndex
);


const ackPromise = this.waitForReceived(
    collection,
    batchId,
    chunk.chunkIndex,
    requestId
);

this.socket.emit(
    EVENTS.CHUNK,
    {
        collection,
        batchId,
        requestId,
        chunkIndex: chunk.chunkIndex,
        totalChunks: chunk.totalChunks,
        payloadSize: chunk.payloadSize,
        data: chunk.data
    }
);

console.log(
    "⏳ CONNECTOR WAITING ACK:",
    collection,
    batchId,
    chunk.chunkIndex
);

await ackPromise;

        this.session.nextChunk();

    }

    console.log(
    "Sending COMPLETE",
    collection
);

    const completedPromise = this.waitForCompleted(
    collection,
    batchId,
    requestId
);

this.socket.emit(
    EVENTS.COMPLETE,
    {
        collection,
        batchId,
        requestId,
        totalChunks: chunks.length,
        totalItems: items.length
    }
);

await completedPromise;

    console.log(
    "COMPLETED ACK",
    collection
);

    

    console.log(

        `${collection} completed`

    );

        return true;

    } finally {
        this.session.finish();
    }

}


}

module.exports =
    ConnectorProtocolSender;