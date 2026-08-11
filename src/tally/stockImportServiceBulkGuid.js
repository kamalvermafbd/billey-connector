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

const {
    getLookups
} = require("./lookupCache");


const {
    buildChunks
} = require("../../utils/ChunkBuilder");

const {
    executeChunks
} = require("../../utils/chunkExecutor");


const BULK_GUID_CHUNK_SIZE = 300 * 1024;

const STOCK_GUID_BATCH_SIZE = 50;


async function importStockBulkByGuid({
    company,
    stockGuids
}){
    await selectCompany(company);

if (!stockGuids?.length) {

    return [];

}

const level1Batches = [];

for (
    let i = 0;
    i < stockGuids.length;
    i += STOCK_GUID_BATCH_SIZE
) {
    level1Batches.push(
        stockGuids.slice(
            i,
            i + STOCK_GUID_BATCH_SIZE
        )
    );
}

const allStocks = [];

const lookups =

    getLookups(

        company

    ) || {};

const stockLookup =

    lookups.stockLookup ||

    new Map();

for (
    let batchIndex = 0;
    batchIndex < level1Batches.length;
    batchIndex++
) {

    const level1Batch =
        level1Batches[batchIndex];

    const chunks =
        buildChunks(
            level1Batch,
            BULK_GUID_CHUNK_SIZE
        );

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
      
            for (const stock of stocks) {

    const parent =

        stockLookup.get(

            String(

                stock.parent || ""

            )

            .trim()

            .toUpperCase()

        );

    if (!parent) {

        continue;

    }

    stock.parentGroupGuid =

        parent.guid;

    stock.parentGroupMasterId =

        parent.masterId;

    stock.parentGroupAlterId =

        parent.alterId;

}

        allStocks.push(...stocks);

   return {

    chunkIndex: chunk.chunkIndex,

    totalChunks: chunk.totalChunks,

    stocks: stocks.length

};

    }

});

}

return allStocks;

}

module.exports = {
    importStockBulkByGuid
};