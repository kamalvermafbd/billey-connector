const {
    sendToTally,
    selectCompany
} = require("./tallyService");

const {
    buildVoucherRequest
} = require("./voucherRequest");

const {
    parseVoucherResponse
} = require("./voucherParser");

async function importVouchers({
    company,
    fromDate,
    toDate
}) {

    await selectCompany(company);
const requestXml = buildVoucherRequest({
    company,
    fromDate,
    toDate
});

const responseXml = await sendToTally(requestXml);

const vouchers = parseVoucherResponse(responseXml);

return vouchers;

}

module.exports = {
    importVouchers
};