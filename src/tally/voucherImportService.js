
const {
    sendToTally,
    selectCompany
} = require("./tallyService");

const {
    buildVoucherRequest,
    buildVoucherRequestByGuid
} = require("./voucherRequest");

const {
    buildVoucherGuidRequest
} = require("./voucherGuidRequest");

const {
    parseVoucherResponse,
    parseVoucherGuidResponse
} = require("./voucherParser");


const fs = require("fs");

async function importVoucherGuids({
    company
}) {

     await selectCompany(company);

    const requestXml =
        buildVoucherGuidRequest({
            company
        });

    const xml =
        await sendToTally(requestXml);

    fs.appendFileSync(
    "./logs/send-to-tally-debug.jsonl",
    JSON.stringify({
        stage: "VOUCHER_GUID_REQUEST",
        request: requestXml.substring(0, 1000),
        response: xml.substring(0, 1000)
    }) + "\n"
);    

    const parsed =
        parseVoucherGuidResponse(xml);

        fs.writeFileSync(
    "./logs/voucher-guid-request.xml",
    requestXml,
    "utf8"
);

fs.writeFileSync(
    "./logs/voucher-guid-response.xml",
    xml,
    "utf8"
);

fs.writeFileSync(
    "./logs/voucher-guid-parsed.json",
    JSON.stringify(parsed, null, 2),
    "utf8"
);

    return parsed;

}


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

/*

async function importVoucherByGuid() {
    console.log("Single GUID import skipped");
    return null;
}
*/
async function importVouchers({
    company,
    fromDate,
    toDate,
    lastAlterId = null,
    lookups
}) {

    await selectCompany(company);
const requestXml = buildVoucherRequest({
    company,
    fromDate,
    toDate,
    lastAlterId
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
    importVoucherByGuid,
     importVoucherGuids
};