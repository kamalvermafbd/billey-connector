const DEFAULT_MAX_CHUNK_SIZE = 500 * 1024; // 500 KB

/**
 * Returns UTF-8 byte size
 */
function getObjectSize(obj) {
    return Buffer.byteLength(JSON.stringify(obj), "utf8");
}



/**
 * Split array into byte-size based chunks.
 *
 * @param {Array} items
 * @param {number|Object} options
 * Number = max chunk size (backward compatible)
 * Object = {
 *      maxChunkSize,
 *      getItemSize
 * }
 * @returns {Array}
 */



// ============================================================
// 30072026
// Enhanced to support custom item size calculation.
// Backward compatible with existing export flow.
// ============================================================

 function buildChunks(
    items,
    options = DEFAULT_MAX_CHUNK_SIZE
) {
 
    const config =
    typeof options === "number"
        ? {
              maxChunkSize: options,
              getItemSize: getObjectSize
          }
        : {
              maxChunkSize: DEFAULT_MAX_CHUNK_SIZE,
              getItemSize: getObjectSize,
              ...options
          };

    const {
        maxChunkSize,
        getItemSize
    } = config;

    if (
    !Number.isInteger(maxChunkSize) ||
    maxChunkSize <= 0
    ) {
        throw new Error(
            "Invalid maxChunkSize"
        );
    }

    if (
    typeof getItemSize !== "function"
    ) {
        throw new Error(
            "Invalid getItemSize"
        );
    }

    if (!Array.isArray(items)) {
    throw new Error(
        "buildChunks expects an array"
    );
    }

    if (items.length === 0) {
        return [];
    }

    const chunks = [];

    let currentChunk = [];
    let currentSize = 0;

    for (const [i, item] of items.entries()) {

        if (item == null) {
        throw new Error(
            `Invalid item at index ${i}`
        );
    }

       // const itemSize = getObjectSize(item);
         const itemSize = getItemSize(item);

       

        // Safety (Phase 2 me handle karenge)
        if (itemSize > maxChunkSize) {

            console.log(
            "OVERSIZE ITEM",
            {
                index: i,
                size: itemSize,
                keys: Object.keys(item)
                }
            );
            throw new Error(
                `Single item exceeds chunk size (${itemSize} bytes)`
            );
        }

        if (
            currentChunk.length > 0 &&
            currentSize + itemSize > maxChunkSize
        ) {

           chunks.push({
    payloadSize: currentSize,
    data: currentChunk
});

            currentChunk = [];
            currentSize = 0;
        }

        currentChunk.push(item);
        currentSize += itemSize;
    }

    if (currentChunk.length) {
        chunks.push({
    payloadSize: currentSize,
    data: currentChunk
});
    }

    const totalChunks = chunks.length;

return chunks.map((chunk, index) => ({
    chunkIndex: index + 1,
    totalChunks,
    payloadSize: chunk.payloadSize,
    data: chunk.data
}));

    
}



module.exports = {

    buildChunks,

    getObjectSize,

    DEFAULT_MAX_CHUNK_SIZE

};