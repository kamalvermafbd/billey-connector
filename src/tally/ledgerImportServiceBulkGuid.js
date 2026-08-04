const {
    sendToTally,
    selectCompany
} = require("./tallyService");

const {
    buildLedgerBulkGuidRequest
} = require("./ledgerBulkGuidRequest");

const {
    parseLedgerResponse
} = require("./ledgerParser");


const {
    buildChunks
} = require("../../utils/ChunkBuilder");

const {
    executeChunks
} = require("../../utils/chunkExecutor");

const fs = require("fs");

const BULK_GUID_CHUNK_SIZE = 300 * 1024;

async function importLedgerBulkByGuid({
    company,
    ledgerGuids
}){
    await selectCompany(company);

if (!ledgerGuids?.length) {

    return [];

}

const chunks = buildChunks(
    ledgerGuids,
    BULK_GUID_CHUNK_SIZE
);

const allLedgers = [];

await executeChunks({

    chunks,

    onChunk: async (chunk) => {

        const requestXml =
            buildLedgerBulkGuidRequest({

                company,

                ledgerGuids: chunk.data

            });

       

        const responseXml =
            await sendToTally(requestXml);

       

        if (!responseXml) {

            throw new Error(
                "Empty response received from Tally."
            );

        }

      const ledgers =
            parseLedgerResponse(
                responseXml
            );
            
        

        allLedgers.push(...ledgers);

        return {

            chunkIndex: chunk.chunkIndex,

            totalChunks: chunk.totalChunks,

            ledgers: ledgers.length

        };

    }

});

return allLedgers;

}

module.exports = {
    importLedgerBulkByGuid
};