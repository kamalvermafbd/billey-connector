
const {
    sendToTally,
    selectCompany
} = require("./tallyService");

const {
    buildVoucherRequest,
    buildVoucherRequestByGuid
} = require("./voucherRequest");


const {
    parseVoucherResponse
} = require("./voucherParser");


const fs = require("fs");

async function importVoucherByGuid({
    company,
    voucherGuid,
    lookups
}) {

    await selectCompany(company);

    const requestXml = buildVoucherRequestByGuid({
        company,
        voucherGuid
    });

    const responseXml = await sendToTally(requestXml);

    if (!responseXml) {
        throw new Error("Empty response received from Tally.");
    }

    const vouchers = parseVoucherResponse(
        responseXml,
        lookups
    );

    return vouchers[0] || null;

}

async function importVouchers({
    company,
    fromDate,
    toDate,
    lookups
}) {

    await selectCompany(company);
const requestXml = buildVoucherRequest({
    company,
    fromDate,
    toDate
});

fs.writeFileSync(
    "./logs/request.xml",
    requestXml,
    "utf8"
);
const responseXml = await sendToTally(requestXml);
fs.writeFileSync(
    "./logs/response.xml",
    responseXml,
    "utf8"
);


console.log("Voucher response saved to voucher-response.xml");

if (!responseXml) {

    throw new Error("Empty response received from Tally.");

}



const vouchers = parseVoucherResponse(
    responseXml,
    lookups
);

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
    importVouchers,
    importVoucherByGuid
};