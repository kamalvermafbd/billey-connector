const {
    sendToTally,
    selectCompany
} = require("./tallyService");

const {
    buildStockGuidRequest
} = require("./stockGuidRequest");

const {
    parseStockGuidResponse
} = require("./stockGuidParser");


async function importStockGuids({
    company
}) {

    await selectCompany(company);

    return parseStockGuidResponse(
        await sendToTally(
            buildStockGuidRequest(company)
        )
    );

}


module.exports = {
    importStockGuids
};