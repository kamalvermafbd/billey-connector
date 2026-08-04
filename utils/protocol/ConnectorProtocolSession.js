class ConnectorProtocolSession {

    constructor(socket) {

        this.socket = socket;

        this.collection = null;

        this.batchId = null;

        this.totalChunks = 0;

        this.currentChunk = 0;

        this.totalItems = 0;

        this.items = [];

        this.completed = false;

    }

    start({

        collection,

        batchId,

        items,

        totalChunks

    }) {

        this.collection = collection;

        this.batchId = batchId;

        this.items = items;

        this.totalItems = items.length;

        this.totalChunks = totalChunks;

        this.currentChunk = 0;

        this.completed = false;

    }

    nextChunk() {

        this.currentChunk++;

    }

    finish() {

        this.completed = true;

    }

}

module.exports = ConnectorProtocolSession;