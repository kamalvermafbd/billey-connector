
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
    toDate,
    lookups
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




fs.writeFileSync(
    "./lookups-before-parser.json",
    JSON.stringify(
        {
            ledgerLookupSize: lookups.ledgerLookup?.size,
            partyLookupSize: lookups.partyLookup?.size,
            stockLookupSize: lookups.stockLookup?.size,
            groupLookupSize: lookups.groupLookup?.size
        },
        null,
        2
    )
);

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
    importVouchers
};