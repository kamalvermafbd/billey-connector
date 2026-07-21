const {
    sendToTally,
    selectCompany
} = require("./tallyService");

const {
    buildVoucherTypeRequest
} = require("./voucherTypeRequest");

const {
    parseVoucherTypeResponse
} = require("./voucherTypeParser");

async function importVoucherTypes({
    company
}) {

    await selectCompany(company);

    const requestXml = buildVoucherTypeRequest();

    const responseXml = await sendToTally(requestXml);

    return parseVoucherTypeResponse(responseXml);

}

module.exports = {
    importVoucherTypes
};