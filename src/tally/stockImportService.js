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
    company,
    lastStockAlterId = null
}) {

    await selectCompany(company);

    const requestXml = buildStockRequest({
        company,
        lastStockAlterId
    });

    console.log("=================================");
console.log("Stock Request XML");
console.log(requestXml);
console.log("=================================");

    const responseXml = await sendToTally(requestXml);

    return parseStockResponse(responseXml);

}

module.exports = {
    importStocks
};