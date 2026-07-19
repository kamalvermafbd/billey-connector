const {
    sendToTally,
    selectCompany
} = require("./tallyService");

const {
    buildStockRequest
} = require("./stockRequest");

const {
    parseStockResponse
} = require("./stockParser");

async function importStocks({
    company
}) {

    await selectCompany(company);

    const requestXml = buildStockRequest();

    const responseXml = await sendToTally(requestXml);

    return parseStockResponse(responseXml);

}

module.exports = {
    importStocks
};