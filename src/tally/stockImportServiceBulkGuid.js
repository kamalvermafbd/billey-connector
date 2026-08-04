const {
    sendToTally,
    selectCompany
} = require("./tallyService");

const {
    buildStockBulkGuidRequest
} = require("./stockBulkGuidRequest");

const {
    parseStockResponse
} = require("./stockParser");
/*
const {
    getLookups
} = require("./lookupCache");
*/

const {
    buildChunks
} = require("../../utils/ChunkBuilder");

const {
    executeChunks
} = require("../../utils/chunkExecutor");

const fs = require("fs");

const BULK_GUID_CHUNK_SIZE = 300 * 1024;

async function importStockBulkByGuid({
    company,
    stockGuids
}){
    await selectCompany(company);

  
/*
    const lookups = getLookups(company);

if (!lookups) {

    throw new Error(
        "Lookup cache not found. Run importMasters() before Bulk GUID import."
    );

}

*/

if (!stockGuids?.length) {

    return [];

}

const chunks = buildChunks(
    stockGuids,
    BULK_GUID_CHUNK_SIZE
);

const allStocks = [];

await executeChunks({

    chunks,

    onChunk: async (chunk) => {

        const requestXml =
    buildStockBulkGuidRequest({

        company,

        stockGuids: chunk.data

    });

        

        const responseXml =
            await sendToTally(requestXml);


        if (!responseXml) {

            throw new Error(
                "Empty response received from Tally."
            );

        }

       const stocks =
            parseStockResponse(
                responseXml
            );
      

        allStocks.push(...stocks);

   return {

    chunkIndex: chunk.chunkIndex,

    totalChunks: chunk.totalChunks,

    stocks: stocks.length

};

    }

});

return allStocks;

}

module.exports = {
    importStockBulkByGuid
};