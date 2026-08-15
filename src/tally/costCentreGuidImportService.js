const {
    sendToTally,
    selectCompany
} = require("./tallyService");

const {
    buildCostCentreGuidRequest
} = require("./costCentreGuidRequest");

const {
    parseCostCentreGuidResponse
} = require("./costCentreGuidParser");


async function importCostCentreGuids({
    company
}) {

    await selectCompany(company);

    const requestXml =
        buildCostCentreGuidRequest(
            company
        );

    const responseXml =
        await sendToTally(
            requestXml
        );

    return parseCostCentreGuidResponse(
        responseXml
    );

}


module.exports = {
    importCostCentreGuids
};