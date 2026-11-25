const batches = new Map();
function getDurableChunkIdentity(data) {

    const hasDurableIdentity =
        data?.identityScope !== undefined ||
        data?.companyIdentity !== undefined ||
        data?.payloadFingerprint !== undefined;

    if (!hasDurableIdentity) {
        return null;
    }

    if (
        typeof data.requestId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            data.requestId
        ) ||
        typeof data.identityScope !== "string" ||
        !data.identityScope.trim() ||
        typeof data.companyIdentity !== "string" ||
        !data.companyIdentity.startsWith("guid:") ||
        data.companyIdentity.length <= 5 ||
        typeof data.payloadFingerprint !== "string" ||
        !/^sha256:[0-9a-f]{64}$/i.test(
            data.payloadFingerprint
        ) ||
        typeof data.company !== "string" ||
        !data.company.trim()
    ) {
        throw new Error("INVALID_DURABLE_CHUNK_IDENTITY");
    }

    return JSON.stringify([
        data.requestId,
        data.identityScope,
        data.companyIdentity,
        data.payloadFingerprint,
        data.company
    ]);
}
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
    const durableIdentity = getDurableChunkIdentity(data);
    let batch =
        batches.get(data.batchId);

    if (!batch) {

        batch = {

            chunks: [],

            totalChunks:
                data.totalChunks,

            receivedChunks: 0,

            durableIdentity

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
    if (batch.durableIdentity !== durableIdentity) {
        throw new Error("CHUNK_REQUEST_IDENTITY_MISMATCH");
    }

    if (
        durableIdentity !== null &&
        batch.chunks[data.chunkIndex - 1] &&
        JSON.stringify(batch.chunks[data.chunkIndex - 1]) !==
            JSON.stringify(data.data)
    ) {
        throw new Error("DUPLICATE_CHUNK_PAYLOAD_MISMATCH");
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

function complete(batchId, identityData) {

    const batch = batches.get(batchId);

    if (!batch) {
        throw new Error("Batch not found");
    }

    const identity = getDurableChunkIdentity(identityData);

    if (batch.durableIdentity !== identity) {
        throw new Error("CHUNK_COMPLETE_IDENTITY_MISMATCH");
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