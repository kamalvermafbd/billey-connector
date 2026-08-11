const fs = require("fs");
const path = require("path");

/*
const {
    fetchTallyCollectionByVoucherId
} = require("./src/tally/tallyService");
*/

const {
    fetchTallyCollection,
    fetchVoucherIds
} = require("./src/tally/tallyService");

const {
    parseVoucherResponse
} = require("./src/tally/voucherParser");

// ============================================================
// VOUCHER MASTER ID SERVICE FUNCTION TEST
// ============================================================

const logFile = path.join(
    __dirname,
    "src",
    "logs",
    "voucher-master-id-service-test.log"
);

// Fresh log
fs.writeFileSync(
    logFile,
    ""
);

function writeLog(message) {

    const line =
        `[${new Date().toISOString()}] ${message}\n`;

    fs.appendFileSync(
        logFile,
        line
    );

    
}

// ============================================================
// SINGLE VOUCHER TEST
// ============================================================
/*
async function testVoucherMasterId(voucherId) {

    const company =
        "Guru Kirpa Trading";

    writeLog("");

    writeLog(
        "===================================="
    );

    writeLog(
        "VOUCHER MASTER ID SERVICE TEST"
    );

    writeLog(
        `Tally Company: ${company}`
    );

    writeLog(
        `Requested MasterID: ${voucherId}`
    );

    writeLog(
        "Calling fetchTallyCollectionByVoucherId()..."
    );

    const startedAt =
        Date.now();

    try {

        // ====================================================
        // CALL ACTUAL SERVICE FUNCTION
        // ====================================================

        const result =
            await fetchTallyCollectionByVoucherId({
                company,
                voucherId,

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
                ]
            });

        const durationMs =
            Date.now() - startedAt;

        const responseText =
            String(result || "");

        const responseBytes =
            Buffer.byteLength(
                responseText,
                "utf8"
            );

        // ====================================================
        // RESULT
        // ====================================================

        writeLog(
            "========== TALLY RESPONSE =========="
        );

        writeLog(
            `Duration MS: ${durationMs}`
        );

        writeLog(
            `Response Bytes: ${responseBytes}`
        );

        writeLog(
            `Response KB: ${Math.round(
                responseBytes / 1024
            )}`
        );

        // ====================================================
        // PARSE USING EXISTING PARSER
        // ====================================================

        let vouchers = [];

        try {

            vouchers =
                parseVoucherResponse(
                    responseText
                );

        } catch (parseError) {

            writeLog(
                "========== PARSER FAILED =========="
            );

            writeLog(
                `Parser Error: ${parseError.message}`
            );

            writeLog(
                parseError.stack || ""
            );

            writeLog(
                "===================================="
            );

            return;
        }

        writeLog(
            `Parsed Voucher Records: ${vouchers.length}`
        );

        // ====================================================
        // NO RECORD
        // ====================================================

        if (
            vouchers.length === 0
        ) {

            writeLog(
                "NO ACTUAL VOUCHER RECORD RETURNED"
            );

        }

        // ====================================================
        // CHECK PARSED VOUCHERS
        // ====================================================

        for (
            let i = 0;
            i < vouchers.length;
            i++
        ) {

            const voucher =
                vouchers[i];

            const header =
                voucher.header || {};

            const returnedMasterId =
                header.masterid !== undefined &&
                header.masterid !== null
                    ? Number(header.masterid)
                    : null;

            const returnedAlterId =
                header.alterid !== undefined &&
                header.alterid !== null
                    ? Number(header.alterid)
                    : null;

            const returnedGuid =
                header.guid ||
                null;

            const returnedType =
                header.voucherTypeName ||
                null;

            const returnedNumber =
                header.voucherNumber ||
                null;

            writeLog("");

            writeLog(
                `Voucher ${i + 1} MasterID: ${
                    returnedMasterId !== null
                        ? returnedMasterId
                        : "NOT FOUND"
                }`
            );

            writeLog(
                `Voucher ${i + 1} AlterID: ${
                    returnedAlterId !== null
                        ? returnedAlterId
                        : "NOT FOUND"
                }`
            );

            writeLog(
                `Voucher ${i + 1} GUID: ${
                    returnedGuid ||
                    "NOT FOUND"
                }`
            );

            writeLog(
                `Voucher ${i + 1} Type: ${
                    returnedType ||
                    "NOT FOUND"
                }`
            );

            writeLog(
                `Voucher ${i + 1} Number: ${
                    returnedNumber ||
                    "NOT FOUND"
                }`
            );

            // =================================================
            // EXACT MASTERID PROOF
            // =================================================

            if (
                returnedMasterId ===
                Number(voucherId)
            ) {

                writeLog(
                    "EXACT MASTERID MATCH: YES"
                );

            } else {

                writeLog(
                    "EXACT MASTERID MATCH: NO"
                );

            }
        }

        // ====================================================
        // RAW RESPONSE
        // ====================================================

        writeLog("");

        writeLog(
            "========== RAW RESPONSE XML =========="
        );

        writeLog(
            responseText
        );

        writeLog(
            "===================================="
        );

    } catch (err) {

        const durationMs =
            Date.now() - startedAt;

        writeLog(
            "========== TEST FAILED =========="
        );

        writeLog(
            `Requested MasterID: ${voucherId}`
        );

        writeLog(
            `Duration MS: ${durationMs}`
        );

        writeLog(
            `Error Name: ${err.name}`
        );

        writeLog(
            `Error Message: ${err.message}`
        );

        writeLog(
            err.stack || ""
        );

        writeLog(
            "===================================="
        );
    }
}

// ============================================================
// RUN TESTS
// ============================================================
async function test() {

    const START_MASTER_ID = 11109;
    const TOTAL_TESTS = 100;

    let foundCount = 0;
    let notFoundCount = 0;
    let errorCount = 0;

    writeLog("");
    writeLog("====================================");
    writeLog("SEQUENTIAL VOUCHER MASTER ID TEST");
    writeLog(
        `Starting MasterID: ${START_MASTER_ID}`
    );
    writeLog(
        `Total IDs: ${TOTAL_TESTS}`
    );
    writeLog("====================================");

    for (
        let i = 0;
        i < TOTAL_TESTS;
        i++
    ) {

        const masterId =
            START_MASTER_ID + i;

        try {

            const startedAt =
                Date.now();

            writeLog("");
            writeLog(
                `----- TEST ${i + 1}/${TOTAL_TESTS} -----`
            );

            writeLog(
                `Requested MasterID: ${masterId}`
            );

            writeLog(
                "Calling fetchTallyCollectionByVoucherId()..."
            );

            const result =
                await fetchTallyCollectionByVoucherId({
                    company: "Guru Kirpa Trading",
                    voucherId: masterId
                });

            const durationMs =
                Date.now() - startedAt;

            const responseText =
                String(result || "");

            const vouchers =
                parseVoucherResponse(
                    responseText
                );

            writeLog(
                `Duration MS: ${durationMs}`
            );

            writeLog(
                `Parsed Voucher Records: ${vouchers.length}`
            );

            if (
                vouchers.length === 0
            ) {

                notFoundCount++;

                writeLog(
                    "RESULT: NOT FOUND"
                );

                continue;
            }

            foundCount++;

            for (
                let j = 0;
                j < vouchers.length;
                j++
            ) {

                const voucher =
                    vouchers[j];

                const header =
                    voucher.header || {};

                const returnedMasterId =
                    header.masterid !== undefined &&
                    header.masterid !== null
                        ? Number(header.masterid)
                        : null;

                const returnedAlterId =
                    header.alterid !== undefined &&
                    header.alterid !== null
                        ? Number(header.alterid)
                        : null;

                writeLog(
                    `Voucher ${j + 1} MasterID: ${
                        returnedMasterId !== null
                            ? returnedMasterId
                            : "NOT FOUND"
                    }`
                );

                writeLog(
                    `Voucher ${j + 1} AlterID: ${
                        returnedAlterId !== null
                            ? returnedAlterId
                            : "NOT FOUND"
                    }`
                );

                writeLog(
                    `Voucher ${j + 1} GUID: ${
                        header.guid ||
                        "NOT FOUND"
                    }`
                );

                writeLog(
                    `Voucher ${j + 1} Type: ${
                        header.voucherTypeName ||
                        "NOT FOUND"
                    }`
                );

                writeLog(
                    `Voucher ${j + 1} Number: ${
                        header.voucherNumber ||
                        "NOT FOUND"
                    }`
                );

                if (
                    returnedMasterId === masterId
                ) {

                    writeLog(
                        "EXACT MASTERID MATCH: YES"
                    );

                } else {

                    writeLog(
                        "EXACT MASTERID MATCH: NO"
                    );

                }

            }

        } catch (err) {

            errorCount++;

            writeLog(
                "RESULT: ERROR"
            );

            writeLog(
                `Error Name: ${err.name}`
            );

            writeLog(
                `Error Message: ${err.message}`
            );

        }

    }

    writeLog("");
    writeLog("====================================");
    writeLog("SEQUENTIAL TEST COMPLETE");
    writeLog("====================================");

    writeLog(
        `Total IDs Tested: ${TOTAL_TESTS}`
    );

    writeLog(
        `Vouchers Found: ${foundCount}`
    );

    writeLog(
        `Not Found: ${notFoundCount}`
    );

    writeLog(
        `Errors: ${errorCount}`
    );

    writeLog("====================================");
}

test();
*/

// ============================================================
// 50 MASTER ID BATCH TEST
// ============================================================

async function test() {

    const company =
        "Guru Kirpa Trading";

   const voucherIds =
    await fetchVoucherIds({
        company
    });

const masterIds =
    voucherIds.slice(0, 50);

    writeLog("");
    writeLog("====================================");
    writeLog("50 MASTER ID BATCH TEST");
    writeLog(
        `Tally Company: ${company}`
    );
    writeLog(
        `Master IDs: ${masterIds.length}`
    );
    writeLog("====================================");

    const startedAt =
        Date.now();

    try {

        writeLog(
            "Calling fetchTallyCollection()..."
        );

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

                masterIds

            });

        const durationMs =
            Date.now() - startedAt;

        const responseText =
            String(result || "");

        const responseBytes =
            Buffer.byteLength(
                responseText,
                "utf8"
            );

        writeLog("");
        writeLog(
            "========== TALLY RESPONSE =========="
        );

        writeLog(
            `Duration MS: ${durationMs}`
        );

        writeLog(
            `Response Bytes: ${responseBytes}`
        );

        writeLog(
            `Response KB: ${Math.round(
                responseBytes / 1024
            )}`
        );

        // ====================================================
        // PARSE RESPONSE
        // ====================================================

        const vouchers =
            parseVoucherResponse(
                responseText
            );

        writeLog(
            `Parsed Voucher Records: ${vouchers.length}`
        );

        // ====================================================
        // COLLECT RETURNED MASTER IDS
        // ====================================================

        const returnedIds =
            new Set();

        for (
            let i = 0;
            i < vouchers.length;
            i++
        ) {

            const voucher =
                vouchers[i];

            const header =
                voucher.header || {};

            const masterId =
                header.masterid !== undefined &&
                header.masterid !== null
                    ? Number(header.masterid)
                    : null;

            if (
                masterId !== null
            ) {

                returnedIds.add(
                    masterId
                );

                writeLog("");

                writeLog(
                    `Voucher ${i + 1} MasterID: ${masterId}`
                );

                writeLog(
                    `Voucher ${i + 1} AlterID: ${
                        header.alterid !== undefined
                            ? header.alterid
                            : "NOT FOUND"
                    }`
                );

                writeLog(
                    `Voucher ${i + 1} GUID: ${
                        header.guid ||
                        "NOT FOUND"
                    }`
                );

                writeLog(
                    `Voucher ${i + 1} Type: ${
                        header.voucherTypeName ||
                        "NOT FOUND"
                    }`
                );

                writeLog(
                    `Voucher ${i + 1} Number: ${
                        header.voucherNumber ||
                        "NOT FOUND"
                    }`
                );
            }
        }

        // ====================================================
        // FOUND / NOT FOUND
        // ====================================================

        const foundIds =
            masterIds.filter(
                id =>
                    returnedIds.has(
                        Number(id)
                    )
            );

        const notFoundIds =
            masterIds.filter(
                id =>
                    !returnedIds.has(
                        Number(id)
                    )
            );

        writeLog("");
        writeLog("====================================");
        writeLog("BATCH TEST RESULT");
        writeLog("====================================");

        writeLog(
            `Requested IDs: ${masterIds.length}`
        );

        writeLog(
            `Vouchers Found: ${foundIds.length}`
        );

        writeLog(
            `Not Found: ${notFoundIds.length}`
        );

        writeLog("");

        writeLog(
            `FOUND MASTER IDs: ${
                foundIds.join(", ")
            }`
        );

        writeLog("");

        writeLog(
            `NOT FOUND MASTER IDs: ${
                notFoundIds.join(", ")
            }`
        );

        writeLog("");

        writeLog(
            `Total Duration MS: ${durationMs}`
        );

        writeLog(
            `Average MS per ID: ${
                Math.round(
                    durationMs /
                    masterIds.length
                )
            }`
        );

        writeLog(
            "===================================="
        );

        // ====================================================
        // RAW RESPONSE
        // ====================================================

        writeLog("");
        writeLog(
            "========== RAW RESPONSE XML =========="
        );

        writeLog(
            responseText
        );

        writeLog(
            "===================================="
        );

    } catch (err) {

        const durationMs =
            Date.now() - startedAt;

        writeLog("");
        writeLog(
            "========== BATCH TEST FAILED =========="
        );

        writeLog(
            `Duration MS: ${durationMs}`
        );

        writeLog(
            `Error Name: ${err.name}`
        );

        writeLog(
            `Error Message: ${err.message}`
        );

        writeLog(
            err.stack || ""
        );

        writeLog(
            "===================================="
        );
    }
}

test();