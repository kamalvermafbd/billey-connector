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

    const company =
        "Guru Kirpa Trading";

    const guidFile =
        path.join(
            __dirname,
            "src",
            "logs",
            "voucherLevel1GuidDiscovery.json"
        );

    const summaryFile =
        path.join(
            __dirname,
            "src",
            "logs",
            "voucherBulkGuidTest.log"
        );

    try {

        console.log(
            "======================================"
        );

        console.log(
            "VOUCHER BULK GUID LEVEL-1 TEST"
        );

        console.log(
            "======================================"
        );

        console.log(
            "Company:",
            company
        );

        // ============================================
        // STEP 1
        // READ DISCOVERED GUIDS
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

        const voucherGuids =
    [
        ...new Set(
            voucherRecords
                .map(row => row?.guid)
                .filter(Boolean)
        )
    ].slice(0, 10);

        console.log(
            "GUIDs loaded:",
            voucherGuids.length
        );

        if (!voucherGuids.length) {

            throw new Error(
                "No voucher GUIDs found."
            );

        }

        // ============================================
        // STEP 2
        // BUILD REAL PRODUCTION LOOKUPS
        // Same source as importMasters()
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

        console.log(
            "Fetching Groups..."
        );

        const groups =
            await getGroups(company);

        console.log(
            "Groups:",
            groups.length
        );

        // ============================================
        // BUILD GROUP TREE
        // Same logic used by tallyService
        // ============================================

        const groupTree = {};

        groups.forEach(group => {

            groupTree[group.name] =
                group.parent;

        });

        console.log(
            "Fetching Full Ledgers..."
        );

        const allLedgers =
            await getAllLedgers(
                company,
                groupTree
            );

        console.log(
            "All Ledgers:",
            allLedgers.length
        );

        console.log(
            "Fetching Full Stocks..."
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
            stockItems.map(item => ({

                name:
                    item.NAME,

                unit:
                    typeof item.BASEUNITS === "object"
                        ? item.BASEUNITS["#text"]
                        : item.BASEUNITS || ""

            }));

        console.log(
            "All Stocks:",
            allStocks.length
        );

        // ============================================
        // SAME LOOKUP BUILDER AS importMasters()
        // ============================================

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
            "======================================"
        );

        console.log(
            "LOOKUP CACHE READY"
        );

        console.log(
            "Group Lookup:",
            lookups.groupLookup.size
        );

        console.log(
            "Ledger Lookup:",
            lookups.ledgerLookup.size
        );

        console.log(
            "Stock Lookup:",
            lookups.stockLookup.size
        );

        console.log(
            "Party Lookup:",
            lookups.partyLookup.size
        );

        console.log(
            "======================================"
        );

        // ============================================
        // STEP 3
        // REAL BULK GUID IMPORT
        // ============================================

        console.log(
            "STARTING BULK GUID IMPORT"
        );

        console.log(
            "Total GUIDs:",
            voucherGuids.length
        );

        console.log(
            "Batch Size:",
            "10"
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
        // RESULT
        // ============================================

        const result = {

            test:
                "VOUCHER BULK GUID LEVEL-1",

            company,

            inputGuidRecords:
                voucherRecords.length,

            uniqueInputGuids:
                voucherGuids.length,

            vouchersReturned:
                vouchers.length,

            elapsedMs,

            elapsedSeconds:
                Number(
                    (
                        elapsedMs / 1000
                    ).toFixed(2)
                ),

            batchSize:
                10,

            xmlMaxSize:
                300 * 1024,

            success:
                voucherGuids.length > 0 &&
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

        // ============================================
        // CONSOLE RESULT
        // ============================================

        console.log(
            "======================================"
        );

        console.log(
            "BULK GUID TEST RESULT"
        );

        console.log(
            "======================================"
        );

        console.log(
            "Input GUIDs:",
            result.uniqueInputGuids
        );

        console.log(
            "Vouchers Returned:",
            result.vouchersReturned
        );

        console.log(
            "Elapsed:",
            `${result.elapsedSeconds} seconds`
        );

        console.log(
            "Batch Size:",
            result.batchSize
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
                ? "RESULT: PASS"
                : "RESULT: CHECK REQUIRED"
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
                "VOUCHER BULK GUID LEVEL-1",

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
            "VOUCHER BULK GUID TEST FAILED"
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