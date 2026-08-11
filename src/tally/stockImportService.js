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
    
const {
    getLookups
} = require("./lookupCache");

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

    const stocks =
    parseStockResponse(responseXml);

    const lookups =
        getLookups(company) || {};

    const stockLookup =
        lookups.stockLookup || new Map();

    for (const stock of stocks) {

        const parent =
            stockLookup.get(

                String(stock.parent || "")
                    .trim()
                    .toUpperCase()

            );

        if (!parent) {

            continue;

        }

        stock.parentGroupGuid =
            parent.guid;

            stock.parentGroupMasterId =
                parent.masterId;

            stock.parentGroupAlterId =
                parent.alterId;

        }

        return stocks;

    }

module.exports = {
    importStocks
};