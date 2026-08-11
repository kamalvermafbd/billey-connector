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

    async waitForReady(collection) {

    return new Promise((resolve, reject) => {

        const event =
          EVENTS.READY;

        const onReady = (data) => {

            this.socket.off(
                event,
                onReady
            );

            this.socket.off(
                "disconnect",
                onDisconnect
            );

            if (data.collection !== collection) {
                return;
            }

            resolve(data);

        };

        const onDisconnect = () => {

            this.socket.off(
                event,
                onReady
            );

            reject(
                new Error(
                    "Socket disconnected"
                )
            );

        };

        this.socket.once(
            event,
            onReady
        );

        this.socket.once(
            "disconnect",
            onDisconnect
        );

    });

}


async waitForReceived(
    collection,
    batchId,
    chunkIndex
) {

    return new Promise((resolve, reject) => {

      const event =
    EVENTS.RECEIVED;

        const onReceived = (data) => {

            if (!data) {
                return;
            }

            if (data.collection !== collection) {
                return;
            }

            if (
                data.batchId !== batchId ||
                data.chunkIndex !== chunkIndex
            ) {
                return;
            }

           this.socket.off(
                event,
                onReceived
            );

            this.socket.off(
                "disconnect",
                onDisconnect
            );

            resolve();

        };

        const onDisconnect = () => {

            this.socket.off(
                event,
                onReceived
            );

            reject(
                new Error(
                    "Socket disconnected"
                )
            );

        };

        this.socket.once(
            event,
            onReceived
        );

        this.socket.once(
            "disconnect",
            onDisconnect
        );

    });

}

async waitForCompleted(
    collection,
    batchId
) {

    return new Promise((resolve, reject) => {

        const event =
             EVENTS.COMPLETED;

        const onCompleted = (data) => {

            if (!data) {
                return;
            }

            if (data.collection !== collection) {
                return;
            }

            if (data.batchId !== batchId) {
                return;
            }

            this.socket.off(
                event,
                onCompleted
            );

            this.socket.off(
                "disconnect",
                onDisconnect
            );

            if (data.success === false) {

            return reject(
                new Error(
                    data.error
                )
            );

        }

        resolve();

        };

        const onDisconnect = () => {

            this.socket.off(
                event,
                onCompleted
            );

            reject(
                new Error(
                    "Socket disconnected"
                )
            );

        };

        this.socket.once(
            event,
            onCompleted
        );

        this.socket.once(
            "disconnect",
            onDisconnect
        );

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
    maxChunkSize
) {

    await this.waitForReady(
        collection
    );

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

        this.socket.emit(

           EVENTS.CHUNK,

            {

                collection,

                batchId,

                chunkIndex:
                    chunk.chunkIndex,

                totalChunks:
                    chunk.totalChunks,

                payloadSize:
                    chunk.payloadSize,

                data:
                    chunk.data

            }

        );

        await this.waitForReceived(

            collection,

            batchId,

            chunk.chunkIndex

        );

        this.session.nextChunk();

    }

    console.log(
    "Sending COMPLETE",
    collection
);

        this.socket.emit(

        EVENTS.COMPLETE,

        {

            collection,

            batchId,

            totalChunks:
                chunks.length,

            totalItems:
                items.length

        }

    );

    await this.waitForCompleted(

        collection,

        batchId

    );

    console.log(
    "COMPLETED ACK",
    collection
);

    this.session.finish();

    console.log(

        `${collection} completed`

    );

    return true;

}


}

module.exports =
    ConnectorProtocolSender;