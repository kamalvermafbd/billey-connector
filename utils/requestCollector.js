const batches = new Map();

function addChunk(data) {

    let batch = batches.get(data.batchId);

    if (!batch) {

        batch = {

            chunks: [],

            totalChunks: data.totalChunks,

            receivedChunks: 0

        };

        batches.set(data.batchId, batch);

    }

    if (!batch.chunks[data.chunkIndex - 1]) {

        batch.receivedChunks++;

    }

    batch.chunks[data.chunkIndex - 1] = data.data;

}

function isComplete(batchId) {

    const batch = batches.get(batchId);

    if (!batch) {

        return false;

    }

    return batch.receivedChunks === batch.totalChunks;

}

function complete(batchId) {

    const batch = batches.get(batchId);

    if (!batch) {

        throw new Error("Batch not found");

    }

    const items = batch.chunks.flat();

    batches.delete(batchId);

    return items;

}

module.exports = {

    addChunk,

    isComplete,

    complete

};