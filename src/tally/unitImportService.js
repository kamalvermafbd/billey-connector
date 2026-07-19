const {
    sendToTally,
    selectCompany
} = require("./tallyService");

const {
    buildUnitRequest
} = require("./unitRequest");

const {
    parseUnitResponse
} = require("./unitParser");

async function importUnits({
    company
}) {

    await selectCompany(company);

    const requestXml = buildUnitRequest();

    const responseXml = await sendToTally(requestXml);

    return parseUnitResponse(responseXml);

}

module.exports = {
    importUnits
};