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
    getLookups
} = require("./lookupCache");


const {
    buildChunks
} = require("../../utils/ChunkBuilder");

const {
    executeChunks
} = require("../../utils/chunkExecutor");


const BULK_GUID_CHUNK_SIZE = 300 * 1024;

const LEDGER_GUID_BATCH_SIZE = 50;


async function importLedgerBulkByGuid({
    company,
    ledgerGuids
}){
    await selectCompany(company);

if (!ledgerGuids?.length) {

    return [];

}

/*
const chunks = buildChunks(
    ledgerGuids,
    BULK_GUID_CHUNK_SIZE
);
*/

const level1Batches = [];

for (
    let i = 0;
    i < ledgerGuids.length;
    i += LEDGER_GUID_BATCH_SIZE
) {

    level1Batches.push(
        ledgerGuids.slice(
            i,
            i + LEDGER_GUID_BATCH_SIZE
        )
    );

}

const allLedgers = [];

  const lookups =

    getLookups(

        company

    ) || {};

const groupLookup =

    lookups.groupLookup ||

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
            
      

for (const ledger of ledgers) {

    const parent =

        groupLookup.get(

            String(

                ledger.parent || ""

            )

            .trim()

            .toUpperCase()

        );

    if (!parent) {

        continue;

    }

    ledger.parentGroupGuid =

        parent.guid;

    ledger.parentGroupMasterId =

        parent.masterId;

    ledger.parentGroupAlterId =

        parent.alterId;

}

        allLedgers.push(...ledgers);

        return {

            chunkIndex: chunk.chunkIndex,

            totalChunks: chunk.totalChunks,

            ledgers: ledgers.length

        };

    }

});

}

return allLedgers;

}

module.exports = {
    importLedgerBulkByGuid
};