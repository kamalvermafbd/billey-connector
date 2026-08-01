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
        buildLedgerGuidRequest();



    const responseXml =
        await sendToTally(requestXml);

    console.log(
    "LEDGER GUID XML RESPONSE"
);

console.log(
    responseXml
);

    const ledgerGuids =
        parseLedgerGuidResponse(responseXml);



    return ledgerGuids;


}



module.exports = {

    importLedgerGuids

};