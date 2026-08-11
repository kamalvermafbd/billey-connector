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
    company,
    masterIds = []
}) {

    await selectCompany(company);

   // const requestXml = buildGroupRequest();
const requestXml =
    buildGroupRequest({
        masterIds
    });
    
    const responseXml = await sendToTally(requestXml);

    const groups = parseGroupResponse(responseXml);

    return groups;

}

module.exports = {
    importGroups
};