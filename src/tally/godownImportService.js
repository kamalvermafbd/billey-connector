const {
    sendToTally,
    selectCompany
} = require("./tallyService");

const {
    buildGodownRequest
} = require("./godownRequest");

const {
    parseGodownResponse
} = require("./godownParser");

async function importGodowns({ company }) {

    await selectCompany(company);

    const requestXml = buildGodownRequest();

    const responseXml = await sendToTally(requestXml);

    return parseGodownResponse(responseXml);

}

module.exports = {
    importGodowns
};