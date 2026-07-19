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
    company
}) {

    await selectCompany(company);

    const requestXml = buildLedgerRequest();

    const responseXml = await sendToTally(requestXml);

    return parseLedgerResponse(responseXml);

}

module.exports = {
    importLedgers
};