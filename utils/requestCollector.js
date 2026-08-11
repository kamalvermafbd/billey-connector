const batches = new Map();

function addChunk(data) {

    if (!data?.batchId) {
        throw new Error(
            "Chunk missing batchId"
        );
    }

    if (
        !Number.isInteger(data.chunkIndex) ||
        data.chunkIndex < 1
    ) {
        throw new Error(
            `Invalid chunkIndex: ${data.chunkIndex}`
        );
    }

    if (
        !Number.isInteger(data.totalChunks) ||
        data.totalChunks < 1
    ) {
        throw new Error(
            `Invalid totalChunks: ${data.totalChunks}`
        );
    }

    if (data.chunkIndex > data.totalChunks) {
        throw new Error(
            `Chunk index ${data.chunkIndex} exceeds totalChunks ${data.totalChunks}`
        );
    }

    if (!Array.isArray(data.data)) {
        throw new Error(
            "Chunk data must be an array"
        );
    }

    let batch =
        batches.get(data.batchId);

    if (!batch) {

        batch = {

            chunks: [],

            totalChunks:
                data.totalChunks,

            receivedChunks: 0

        };

        batches.set(
            data.batchId,
            batch
        );

    } else if (
        batch.totalChunks !==
        data.totalChunks
    ) {

        throw new Error(
            `totalChunks mismatch for batch ${data.batchId}`
        );

    }

    if (
        !batch.chunks[
            data.chunkIndex - 1
        ]
    ) {

        batch.receivedChunks++;

    }

    batch.chunks[
        data.chunkIndex - 1
    ] = data.data;

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