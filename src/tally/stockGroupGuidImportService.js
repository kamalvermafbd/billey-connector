const {
    sendToTally,
    selectCompany
} = require("./tallyService");

const {
    buildStockGroupGuidRequest
} = require("./stockGroupGuidRequest");

const {
    parseStockGroupGuidResponse
} = require("./stockGroupGuidParser");


async function importStockGroupGuids({
    company
}) {

    await selectCompany(company);

    const requestXml =
        buildStockGroupGuidRequest(
            company
        );

    const responseXml =
        await sendToTally(
            requestXml
        );

    return parseStockGroupGuidResponse(
        responseXml
    );
}


module.exports = {
    importStockGroupGuids
};