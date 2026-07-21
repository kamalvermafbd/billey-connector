const {
    sendToTally,
    selectCompany
} = require("./tallyService");

const {
    buildStockGroupRequest
} = require("./stockGroupRequest");

const {
    parseStockGroupResponse
} = require("./stockGroupParser");

async function importStockGroups({
    company
}) {

    await selectCompany(company);

    const requestXml = buildStockGroupRequest();

    const responseXml = await sendToTally(requestXml);

    return parseStockGroupResponse(responseXml);

}

module.exports = {
    importStockGroups
};