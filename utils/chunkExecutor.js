/**
 * Execute chunks sequentially.
 *
 * @param {Object} options
 * @param {Array} options.chunks
 * @param {Function} options.onChunk
 * @returns {Promise<Array>}
 */
async function executeChunks({

    chunks,

    onChunk

}) {

    if (!Array.isArray(chunks)) {

        throw new Error("chunks must be an array");

    }

    if (typeof onChunk !== "function") {

        throw new Error("onChunk must be a function");

    }

    const results = [];

    for (const chunk of chunks) {

        const result = await onChunk(chunk);

        results.push(result);

    }

    return results;

}

module.exports = {

    executeChunks

};