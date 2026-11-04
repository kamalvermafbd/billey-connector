const crypto = require("crypto");

const {
    buildChunks
} = require("../ChunkBuilder");

const EVENTS =
    require("./ProtocolEvents");

const ConnectorProtocolSession =
    require("./ConnectorProtocolSession");

class ConnectorProtocolSender {
/* 041126
    constructor(socket) {
    this.socket = socket;

    // Master-only READY registrations.
    // Key: requestId + collection
    this.masterReadyRegistrations = new Map();

    // READY messages captured before their waiter starts.
    this.masterReadyBuffer = new Map();

    // Keys already consumed during an active master transfer.
       this.masterReadyConsumed = new Set();
}
*/
constructor(socket) {
    this.socket = socket;

    this.masterReadyRegistrations = new Map();
    this.masterReadyBuffer = new Map();
    this.masterReadyConsumed = new Set();
    this.masterReadyWaiters = new Map();

    this.masterReadyListener = (data) => {
        this.captureMasterReady(data);
    };

    this.masterReadyDisconnectListener = () => {
        for (const waiter of this.masterReadyWaiters.values()) {
            waiter.reject(new Error("Socket disconnected"));
        }

        this.masterReadyWaiters.clear();
        this.masterReadyRegistrations.clear();
        this.masterReadyBuffer.clear();
        this.masterReadyConsumed.clear();

           this.socket.off(EVENTS.READY, this.masterReadyListener);
        this.socket.off(
            "disconnect",
            this.masterReadyDisconnectListener
        );

        this.masterReadyListenerAttached = false;
    };

    this.masterReadyListenerAttached = false;
}
static get MASTER_COLLECTIONS() {
    return [
        "getMastersGroups",
        "getMastersUnits",
        "getMastersLedgers",
        "getMastersStockGroups",
        "getMastersStocks",
        "getMastersGodowns",
        "getMastersCostCentres",
        "getMasters"
    ];
}

      masterReadyKey(requestId, collection) {
        return JSON.stringify([requestId, collection]);
    }

    registerMasterReady(requestId) {
        if (typeof requestId !== "string" || !requestId.trim()) {
            throw new Error("Master READY registration requires requestId");
        }

               const maxActiveMasterRequests = 4;
        const collectionsPerRequest =
            ConnectorProtocolSender.MASTER_COLLECTIONS.length;

        if (
            this.masterReadyRegistrations.size +
                collectionsPerRequest >
            maxActiveMasterRequests * collectionsPerRequest
        ) {
            throw new Error(
                "Master READY registration capacity exceeded"
            );
        }

        const keys = ConnectorProtocolSender.MASTER_COLLECTIONS.map(
            (collection) => this.masterReadyKey(requestId, collection)
        );
        // Reject duplicate registration before changing any state.
        for (const key of keys) {
            if (
                this.masterReadyRegistrations.has(key) ||
                this.masterReadyConsumed.has(key)
            ) {
                throw new Error(
                    `Duplicate active master READY registration: ${key}`
                );
            }
        }
/* 041126
             for (const key of keys) {
            this.masterReadyRegistrations.set(key, true);
        }
    }

    unregisterMasterReady(requestId) {
        for (const collection of ConnectorProtocolSender.MASTER_COLLECTIONS) {
            const key = this.masterReadyKey(requestId, collection);

            this.masterReadyRegistrations.delete(key);
            this.masterReadyBuffer.delete(key);
            this.masterReadyConsumed.delete(key);
        }
        }
        */

                for (const key of keys) {
            this.masterReadyRegistrations.set(key, true);
        }

        if (!this.masterReadyListenerAttached) {
            this.socket.on(EVENTS.READY, this.masterReadyListener);
            this.socket.on(
                "disconnect",
                this.masterReadyDisconnectListener
            );
            this.masterReadyListenerAttached = true;
        }
    }

    unregisterMasterReady(requestId) {
        for (const collection of ConnectorProtocolSender.MASTER_COLLECTIONS) {
            const key = this.masterReadyKey(requestId, collection);

            const waiter = this.masterReadyWaiters.get(key);

            if (waiter) {
                waiter.reject(
                    new Error(
                        `Master READY registration ended: ${collection}`
                    )
                );
            }

            this.masterReadyWaiters.delete(key);
            this.masterReadyRegistrations.delete(key);
            this.masterReadyBuffer.delete(key);
            this.masterReadyConsumed.delete(key);
        }

        if (
            this.masterReadyRegistrations.size === 0 &&
            this.masterReadyListenerAttached
        ) {
            this.socket.off(EVENTS.READY, this.masterReadyListener);
            this.socket.off(
                "disconnect",
                this.masterReadyDisconnectListener
            );
            this.masterReadyListenerAttached = false;
        }
    }
    captureMasterReady(data) {
        if (
            !data ||
            typeof data.requestId !== "string" ||
            !data.requestId ||
            !ConnectorProtocolSender.MASTER_COLLECTIONS.includes(
                data.collection
            )
        ) {
            return;
        }

        const key = this.masterReadyKey(
            data.requestId,
            data.collection
        );

        // Only capture explicitly registered master collections.
        if (!this.masterReadyRegistrations.has(key)) {
            return;
        }

        // Never buffer a READY already consumed by its transfer.
        if (this.masterReadyConsumed.has(key)) {
            return;
        }

                // First matching READY wins, including explicit rejection.
        if (this.masterReadyBuffer.has(key)) {
            return;
        }

        this.masterReadyBuffer.set(key, data);

        const waiter = this.masterReadyWaiters.get(key);

        if (waiter) {
            try {
                waiter.resolve(
                    this.consumeMasterReady(
                        data.collection,
                        data.requestId
                    )
                );
            } catch (error) {
                waiter.reject(error);
            }
        }
    }

    consumeMasterReady(collection, requestId) {
        const key = this.masterReadyKey(requestId, collection);

        if (!this.masterReadyRegistrations.has(key)) {
            return null;
        }

        if (this.masterReadyConsumed.has(key)) {
            throw new Error(
                `Master READY already consumed: ${collection}, request ${requestId}`
            );
        }

        if (!this.masterReadyBuffer.has(key)) {
            return null;
        }

        const data = this.masterReadyBuffer.get(key);

        this.masterReadyBuffer.delete(key);
        this.masterReadyConsumed.add(key);

        if (data.success === false) {
            throw new Error(
                data.error || `Protocol READY rejected: ${collection}`
            );
        }

        return data;
    }

    async waitForReady(collection, requestId) {
        const key = this.masterReadyKey(requestId, collection);

        if (this.masterReadyRegistrations.has(key)) {
            if (this.masterReadyConsumed.has(key)) {
                throw new Error(
                    `Master READY already consumed: ${collection}`
                );
            }

            if (this.masterReadyWaiters.has(key)) {
                throw new Error(
                    `Duplicate master READY waiter: ${collection}`
                );
            }

            if (this.masterReadyBuffer.has(key)) {
                return this.consumeMasterReady(collection, requestId);
            }

            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    cleanup();
                    reject(
                        new Error(
                            `Protocol READY timeout: ${collection}, request ${requestId}`
                        )
                    );
                }, 120 * 1000);

                const cleanup = () => {
                    clearTimeout(timeout);
                    this.masterReadyWaiters.delete(key);
                };

                this.masterReadyWaiters.set(key, {
                    resolve: (data) => {
                        cleanup();
                        resolve(data);
                    },
                    reject: (error) => {
                        cleanup();
                        reject(error);
                    }
                });
            });
        }

        // Legacy path for unregistered collections.
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
/* 041126
    this.session.start({

        collection,

        batchId,

        items,

        totalChunks:
            chunks.length

    });
*/

const session = new ConnectorProtocolSession(this.socket);

session.start({
    collection,
    batchId,
    items,
    totalChunks: chunks.length
});

   return {
    batchId,
    chunks,
    session
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

      const {
       batchId,
       chunks,
       session
   } = this.createSession(
        collection,
        items,
        maxChunkSize
        );

    try {

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

        session.nextChunk();

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
    session.finish();
}

}


}

module.exports =
    ConnectorProtocolSender;