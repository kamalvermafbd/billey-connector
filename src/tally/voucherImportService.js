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

const fs = require("fs");

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

fs.writeFileSync(
    "./voucher-response.xml",
    responseXml,
    "utf8"
);

console.log("Voucher response saved to voucher-response.xml");

if (!responseXml) {

    throw new Error("Empty response received from Tally.");

}

const vouchers = parseVoucherResponse(responseXml);

return {

    summary: {

        totalVouchers: vouchers.length,

        fromDate,

        toDate,

        company

    },

    vouchers

};

}

module.exports = {
    importVouchers
};