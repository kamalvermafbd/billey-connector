const {
    sendToTally,
    selectCompany
} = require("./tallyService");


const {
    buildLedgerRequest
} = require("./ledgerRequest");

const {
    parseLedgerResponse
} = require("./ledgerParser");

const {
    getLookups
} = require("./lookupCache");


async function importLedgers({
    company,
    booksBeginningFrom,
    lastLedgerAlterId = null,
    masterIds = []
}){

    console.log("Ledger booksBeginningFrom:", booksBeginningFrom);
    
    await selectCompany(company);

    

   const requestXml = buildLedgerRequest({
        booksBeginningFrom,
        lastLedgerAlterId,
        masterIds
    });

    const responseXml = await sendToTally(requestXml);

    const ledgers =

    parseLedgerResponse(

        responseXml

    );

 const lookups =

    getLookups(

        company

    ) || {};

const groupLookup =

    lookups.groupLookup ||

    new Map();

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

  

    return ledgers;



}

module.exports = {
    importLedgers
};