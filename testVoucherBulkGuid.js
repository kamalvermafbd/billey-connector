const fs = require("fs");
const path = require("path");

const {
    getGroups,
    getAllLedgers,
    getStockItems
} = require("./src/tally/tallyService");

const {
    buildTallyLookups
} = require("./src/tally/tallyLookups");

const {
    setLookups
} = require("./src/tally/lookupCache");

const {
    importVoucherBulkByGuid
} = require("./src/tally/voucherImportServiceBulkGuid");


(async () => {

    const company = "Guru Kirpa Trading";

    const guidFile = path.join(
        __dirname,
        "src",
        "logs",
        "voucherLevel1GuidDiscovery.json"
    );

    const summaryFile = path.join(
        __dirname,
        "src",
        "logs",
        "voucherBulkGuidTest.log"
    );


    try {

        console.log("======================================");
        console.log("VOUCHER BULK GUID DIRECT TEST");
        console.log("======================================");

        console.log("Company:", company);


        // ============================================
        // STEP 1
        // LOAD ONE REAL GUID
        // ============================================

        if (!fs.existsSync(guidFile)) {

            throw new Error(
                `GUID file not found: ${guidFile}`
            );

        }


        const voucherRecords =
            JSON.parse(
                fs.readFileSync(
                    guidFile,
                    "utf8"
                )
            );


        if (!Array.isArray(voucherRecords)) {

            throw new Error(
                "GUID discovery file must contain an array."
            );

        }


        /*
         * IMPORTANT
         *
         * ReconciliationManager produces:
         *
         * [
         *   {
         *      guid: "...",
         *      ...
         *   }
         * ]
         *
         * For this test we take ONLY ONE GUID.
         *
         * This bypasses:
         *
         * Socket.IO
         * sendChunkedToConnector
         * requestCollector
         *
         * We directly test:
         *
         * GUID
         *   ↓
         * importVoucherBulkByGuid()
         *   ↓
         * Tally
         */

        const voucherGuids = [
            ...new Set(
                voucherRecords
                    .map(
                        row => row?.guid
                    )
                    .filter(Boolean)
            )
        ].slice(0, 1);


        console.log(
            "Test GUID count:",
            voucherGuids.length
        );


        console.log(
            "Test GUID:",
            voucherGuids[0] || "NONE"
        );


        if (!voucherGuids.length) {

            throw new Error(
                "No voucher GUID found."
            );

        }


        // ============================================
        // STEP 2
        // BUILD SAME LOOKUP CACHE
        // ============================================

        console.log(
            "======================================"
        );

        console.log(
            "BUILDING LOOKUP CACHE"
        );

        console.log(
            "======================================"
        );


        const groups =
            await getGroups(
                company
            );


        console.log(
            "Groups:",
            groups.length
        );


        const groupTree = {};


        groups.forEach(
            group => {

                groupTree[
                    group.name
                ] =
                    group.parent;

            }
        );


        const allLedgers =
            await getAllLedgers(
                company,
                groupTree
            );


        console.log(
            "Ledgers:",
            allLedgers.length
        );


        const stockJson =
            await getStockItems(
                company
            );


        const stockRaw =
            stockJson
                ?.ENVELOPE
                ?.BODY
                ?.DATA
                ?.COLLECTION
                ?.STOCKITEM;


        const stockItems =
            Array.isArray(stockRaw)
                ? stockRaw
                : stockRaw
                    ? [stockRaw]
                    : [];


        const allStocks =
            stockItems.map(
                item => ({

                    name:
                        item.NAME,

                    unit:
                        typeof item.BASEUNITS === "object"
                            ? item.BASEUNITS["#text"]
                            : item.BASEUNITS || ""

                })
            );


        console.log(
            "Stocks:",
            allStocks.length
        );


        const lookups =
            buildTallyLookups({

                groups,

                ledgers:
                    allLedgers,

                stocks:
                    allStocks

            });


        setLookups(
            company,
            lookups
        );


        console.log(
            "LOOKUP CACHE READY"
        );


        // ============================================
        // STEP 3
        // DIRECT BULK GUID TEST
        // ============================================

        console.log(
            "======================================"
        );

        console.log(
            "STARTING DIRECT BULK GUID TEST"
        );

        console.log(
            "======================================"
        );


        const startedAt =
            Date.now();


        const vouchers =
            await importVoucherBulkByGuid({

                company,

                voucherGuids

            });


        const elapsedMs =
            Date.now() -
            startedAt;


        // ============================================
        // STEP 4
        // RESULT
        // ============================================

        const returnedGuids =
            vouchers
                .map(
                    voucher =>
                        voucher?.guid
                )
                .filter(Boolean);


        const result = {

            test:
                "DIRECT VOUCHER BULK GUID",

            company,

            inputGuid:
                voucherGuids[0],

            inputGuidCount:
                voucherGuids.length,

            vouchersReturned:
                vouchers.length,

            returnedGuids,

            elapsedMs,

            elapsedSeconds:
                Number(
                    (
                        elapsedMs /
                        1000
                    ).toFixed(2)
                ),

            success:
                vouchers.length > 0

        };


        fs.writeFileSync(

            summaryFile,

            JSON.stringify(
                result,
                null,
                2
            ),

            "utf8"

        );


        console.log(
            "======================================"
        );

        console.log(
            "DIRECT BULK GUID TEST RESULT"
        );

        console.log(
            "======================================"
        );


        console.log(
            "Input GUID:",
            result.inputGuid
        );


        console.log(
            "Vouchers Returned:",
            result.vouchersReturned
        );


        console.log(
            "Returned GUIDs:",
            result.returnedGuids
        );


        console.log(
            "Elapsed:",
            `${result.elapsedSeconds} seconds`
        );


        console.log(
            "Summary:",
            summaryFile
        );


        console.log(
            "======================================"
        );


        console.log(
            result.success
                ? "RESULT: PASS — TALLY GUID FETCH WORKS"
                : "RESULT: FAIL — TALLY GUID FETCH RETURNED 0"
        );


        console.log(
            "======================================"
        );


        if (!result.success) {

            process.exitCode = 1;

        }


    } catch (err) {


        const errorResult = {

            test:
                "DIRECT VOUCHER BULK GUID",

            company,

            success:
                false,

            error:
                err.message,

            stack:
                err.stack

        };


        fs.writeFileSync(

            summaryFile,

            JSON.stringify(
                errorResult,
                null,
                2
            ),

            "utf8"

        );


        console.error(
            "======================================"
        );


        console.error(
            "DIRECT BULK GUID TEST FAILED"
        );


        console.error(
            err.stack
        );


        console.error(
            "======================================"
        );


        process.exitCode = 1;

    }

})();