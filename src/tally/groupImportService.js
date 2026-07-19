const {
    sendToTally,
    selectCompany
} = require("./tallyService");

const {
    buildGroupRequest
} = require("./groupRequest");

const {
    parseGroupResponse
} = require("./groupParser");

async function importGroups({
    company
}) {

    await selectCompany(company);

    const requestXml = buildGroupRequest();

    const responseXml = await sendToTally(requestXml);

    const groups = parseGroupResponse(responseXml);

    return groups;

}

module.exports = {
    importGroups
};