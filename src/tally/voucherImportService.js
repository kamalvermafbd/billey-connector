const {
    sendToTally,
    selectCompany,
    fetchVoucherIds,
    fetchTallyCollection
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
    company,
    fromDate,
    toDate,
    booksBeginningFrom,
    lastAlterId,
    syncMode,
    syncPeriod
}) {

    if (!company) {
        throw new Error(
            "company missing in importVoucherGuids"
        );
    }

    if (!fromDate) {
        throw new Error(
            "fromDate missing in importVoucherGuids"
        );
    }

    if (!toDate) {
    throw new Error(
        "toDate missing in importVoucherGuids"
    );
}

if (!booksBeginningFrom) {
    throw new Error(
        "booksBeginningFrom missing in importVoucherGuids"
    );
}

/*
if (!Number.isFinite(Number(lastAlterId))) {
    throw new Error(
        "lastAlterId missing or invalid in importVoucherGuids"
    );
}
*/
    await selectCompany(company);

    // ============================================
    // MASTERID BOUNDED DISCOVERY
    // MASTERID = discovery boundary only
    // GUID = actual voucher identity
    // ============================================

    const allRecords =
    await fetchVoucherIds({
        company,
        fromDate,
        toDate,
        booksBeginningFrom,
        lastAlterId,
        syncMode
    });

    
console.log(
    "Total Voucher Records:",
    allRecords.length
);

    // ============================================
    // UNIQUE GUIDS
    // ============================================

    const uniqueByGuid =
        new Map();

    for (const record of allRecords) {

        if (!record.guid) {
            continue;
        }

        uniqueByGuid.set(
            record.guid,
            record
        );
    }

    const finalRecords =
        Array.from(
            uniqueByGuid.values()
        );

    console.log(
        "======================================"
    );

    // ============================================
// LEVEL-1
// 50 VOUCHERS PER TALLY REQUEST
// ============================================
/*
const LEVEL1_BATCH_SIZE = 500;

const level1Results = [];

for (
    let i = 0;
    i < finalRecords.length;
    i += LEVEL1_BATCH_SIZE
) {

    const batch =
        finalRecords.slice(
            i,
            i + LEVEL1_BATCH_SIZE
        );

    console.log(
        `Voucher Level-1 Batch ${
            Math.floor(i / LEVEL1_BATCH_SIZE) + 1
        } : ${batch.length}`
    );

    const masterIds =
    batch
        .map(
            row => Number(row.masterid)
        )
        .filter(
            Number.isFinite
        );

    if (!masterIds.length) {
    throw new Error(
        `Voucher Level-1 Batch ${
            Math.floor(i / LEVEL1_BATCH_SIZE) + 1
        } contains no valid MASTERIDs`
    );
}

    const result =
        await fetchTallyCollection({

            company,

            collectionName:
                "BilleyVoucherCollection",

            collectionType:
                "Voucher",

            fetchFields: [
                "GUID",
                "MASTERID",
                "ALTERID",
                "DATE",
                "EFFECTIVEDATE",
                "VOUCHERTYPENAME",
                "VOUCHERNUMBER",
                "REFERENCE",
                "REFERENCEDATE",
                "PARTYLEDGERNAME",
                "NARRATION",
                "ISINVOICE",
                "ISOPTIONAL",
                "ISCANCELLED"
            ],

            masterIds,

            fromDate,
            toDate

        });

 console.log(
    "LEVEL-1 DATE FILTER:",
    fromDate,
    "→",
    toDate
);

    level1Results.push(
        result
    );
}
*/
    console.log(
        "FULL VOUCHER GUID DISCOVERY"
    );

    console.log(
        "Date Range:",
        fromDate,
        "→",
        toDate
    );

    console.log(
        "Total Records:",
        finalRecords.length
    );

    console.log(
        "Unique GUIDs:",
        finalRecords.length
    );

    console.log(
        "======================================"
    );

    return finalRecords;
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