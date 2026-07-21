const {
    sendToTally,
    selectCompany
} = require("./tallyService");

const {
    buildCostCentreRequest
} = require("./costCentreRequest");

const {
    parseCostCentreResponse
} = require("./costCentreParser");

async function importCostCentres({
    company
}) {

    await selectCompany(company);

    const requestXml = buildCostCentreRequest();

    const responseXml = await sendToTally(requestXml);

    return parseCostCentreResponse(responseXml);

}

module.exports = {
    importCostCentres
};