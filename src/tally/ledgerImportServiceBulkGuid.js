const {
    sendToTally,
    selectCompany,
    getGroups
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


const BULK_GUID_CHUNK_SIZE = 300 * 1024;

const LEDGER_GUID_BATCH_SIZE = 50;

function resolveLedgerNature(parentName, groupLookup) {

    let current =
        String(parentName || "").trim();

    const visited = new Set();

    while (current && !visited.has(current)) {

        visited.add(current);

        const group =
            groupLookup.get(
                current.toUpperCase()
            );

        if (!group) {
            return "";
        }

        const reserved =
            String(group.reservedName || "").trim();

        if (
            reserved === "Current Assets" ||
            reserved === "Fixed Assets"
        ) {
            return "Assets";
        }

        if (
            reserved === "Current Liabilities" ||
            reserved === "Loans (Liability)"
        ) {
            return "Liabilities";
        }

        if (reserved === "Capital Account") {
            return "Capital";
        }

        current =
            String(group.parent || "").trim();

        if (!current || /^Primary$/i.test(current)) {
            return "";
        }
    }

    return "";
}

async function importLedgerBulkByGuid({
    company,
    ledgerGuids,
    groups = [],
    booksBeginningFrom
}) {
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

 const resolvedGroups =
    groups?.length
        ? groups
        : await getGroups(company);

const groupLookup =
    new Map(
        resolvedGroups.map(group => [
            String(group.name || "")
                .trim()
                .toUpperCase(),
            group
        ])
    );

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

                ledgerGuids: chunk.data,

                booksBeginningFrom

            });

       console.log("======================================");
console.log("BULK LEDGER DATE TEST");
console.log("COMPANY :", company);
console.log("FROM    :", booksBeginningFrom);
console.log("TO      :", booksBeginningFrom);
console.log("======================================");

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

  ledger.parentGroupGuid =
    ledger.parentGroupGuid ||
    parent?.guid ||
    null;

ledger.parentGroupMasterId =
    ledger.parentGroupMasterId ||
    parent?.masterId ||
    null;

ledger.parentGroupAlterId =
    ledger.parentGroupAlterId ||
    parent?.alterId ||
    null;

ledger.parentGroupReservedName =
    parent?.reservedName || "";

ledger.nature =
    resolveLedgerNature(
        ledger.parent,
        groupLookup
    );

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