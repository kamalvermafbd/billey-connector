
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
/*
    fs.appendFileSync(
    "./logs/send-to-tally-debug.jsonl",
    JSON.stringify({
        stage: "VOUCHER_GUID_REQUEST",
        request: requestXml.substring(0, 1000),
        response: xml.substring(0, 1000)
    }) + "\n"
);    
*/
    const parsed =
        parseVoucherGuidResponse(xml);
/*
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
*/
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

    console.log("STEP 1 : Before selectCompany");

    await selectCompany(company);

    console.log("STEP 2 : After selectCompany");

    const requestXml = buildVoucherRequest({
    company,
    fromDate,
    toDate,
    lastAlterId
});

console.log("STEP 3 : XML Built");
/*
fs.writeFileSync(
    "./logs/request.xml",
    requestXml,
    "utf8"
);
*/
const responseXml = await sendToTally(requestXml);

console.log("STEP 4 : Response Received");

if (!responseXml) {
    throw new Error("Empty response received from Tally.");
}

console.log(
    "Response XML Size :",
    Buffer.byteLength(responseXml || "", "utf8"),
    "bytes"
);
/*
fs.writeFileSync(
    "./logs/response.xml",
    responseXml,
    "utf8"
);
*/


console.log("STEP 5 : Before parseVoucherResponse");
const parseStart = Date.now();

let vouchers;

try {

    vouchers = parseVoucherResponse(
        responseXml,
        lookups
    );

} catch (err) {

    console.error("❌ parseVoucherResponse FAILED");
    console.error(err.stack);

    throw err;

}

console.log(
    "Parse Time :",
    Date.now() - parseStart,
    "ms"
);

console.log("STEP 6 : After parseVoucherResponse");
console.log("Voucher Count :", vouchers.length);

console.log("STEP 7 : Before return");

console.log("STEP 8 : Returning importVouchers");
console.log("Summary Count :", vouchers.length);
console.log("====================================");


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