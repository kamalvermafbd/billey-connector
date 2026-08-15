const {
    sendToTally,
    selectCompany
} = require("./tallyService");

const {
    buildGroupGuidRequest
} = require("./groupGuidRequest");

const {
    parseGroupGuidResponse
} = require("./groupGuidParser");


async function importGroupGuids({
    company
}) {

    await selectCompany(company);

    const requestXml =
        buildGroupGuidRequest(company);

    const responseXml =
        await sendToTally(requestXml);

    const groupGuids =
        parseGroupGuidResponse(responseXml);

    return groupGuids;

}


module.exports = {
    importGroupGuids
};