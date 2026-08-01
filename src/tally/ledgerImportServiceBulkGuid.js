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

        fs.writeFileSync(

            `./logs/ledger-bulk-guid-request-${chunk.chunkIndex}.xml`,

            requestXml,

            "utf8"

        );

        const responseXml =
            await sendToTally(requestXml);

        fs.writeFileSync(

            `./logs/ledger-bulk-guid-response-${chunk.chunkIndex}.xml`,

            responseXml,

            "utf8"

        );

        if (!responseXml) {

            throw new Error(
                "Empty response received from Tally."
            );

        }

      const ledgers =
            parseLedgerResponse(
                responseXml
            );
            
        fs.writeFileSync(

            `./logs/ledger-bulk-guid-parsed-${chunk.chunkIndex}.json`,

           JSON.stringify(
                ledgers,
                null,
                2
            ),

            "utf8"

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