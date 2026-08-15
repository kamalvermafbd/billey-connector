const {
    sendToTally,
    selectCompany
} = require("./tallyService");

const {
    buildLedgerGuidRequest
} = require("./ledgerGuidRequest");

const {
    parseLedgerGuidResponse
} = require("./ledgerGuidParser");


async function importLedgerGuids({
    company
}) {

    await selectCompany(company);

    const requestXml =
        buildLedgerGuidRequest(company);

    const responseXml =
        await sendToTally(requestXml);

    const ledgerGuids =
        parseLedgerGuidResponse(responseXml);

    return ledgerGuids;
}


module.exports = {
    importLedgerGuids
};