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

async function importLedgers({
    company,
    booksBeginningFrom,
    lastLedgerAlterId = null
}){

    console.log("Ledger booksBeginningFrom:", booksBeginningFrom);
    
    await selectCompany(company);

    

    const requestXml = buildLedgerRequest({
        booksBeginningFrom,
        lastLedgerAlterId
    });

    const responseXml = await sendToTally(requestXml);

    return parseLedgerResponse(responseXml);

}

module.exports = {
    importLedgers
};