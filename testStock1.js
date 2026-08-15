const fs = require("fs");
const path = require("path");

const {
    importStockGuids
} = require("./src/tally/stockGuidImportService");

const {
    importStockBulkByGuid
} = require("./src/tally/stockImportServiceBulkGuid");


(async () => {

    const company =
        "Guru Kirpa Trading";


    const logFile =
        path.join(
            __dirname,
            "src",
            "logs",
            "stockTotalGuidTestResult.json"
        );


    try {

        console.log("================================");
        console.log("STOCK TOTAL GUID TEST");
        console.log("================================");

        console.log(
            "Company:",
            company
        );


        // ============================================
        // STEP 1
        // Tally se ALL actual Stock GUIDs
        // ============================================

        const stockGuids =
            await importStockGuids({
                company
            });


        console.log(
            "Total Stock GUIDs:",
            stockGuids.length
        );


        // ============================================
        // STEP 2
        // ALL GUIDs existing bulk pipeline ko do
        // ============================================

        const importedStocks =
            await importStockBulkByGuid({

                company,

                stockGuids

            });


        console.log(
            "Total Stocks Imported:",
            importedStocks.length
        );


        // ============================================
        // STEP 3
        // Verification details
        // ============================================

        const requestedGuidSet =
            new Set(
                stockGuids
                    .map(item => item.guid)
                    .filter(Boolean)
            );


        const returnedGuidSet =
            new Set(
                importedStocks
                    .map(stock => stock.guid)
                    .filter(Boolean)
            );


        const missingGuids =
            [...requestedGuidSet]
                .filter(
                    guid =>
                        !returnedGuidSet.has(guid)
                );


        const duplicateReturnedGuids =
            importedStocks
                .map(stock => stock.guid)
                .filter(Boolean)
                .filter(
                    (guid, index, array) =>
                        array.indexOf(guid) !== index
                );


        // ============================================
        // STEP 4
        // Names + IDs verification
        // ============================================

        const returnedStocks =
            importedStocks.map(stock => ({

                name:
                    stock.name,

                guid:
                    stock.guid,

                masterId:
                    stock.masterId,

                alterId:
                    stock.alterId,

                parent:
                    stock.parent

            }));


        // ============================================
        // STEP 5
        // Final result
        // ============================================

        const result = {

            test:
                "STOCK TOTAL GUID",

            company,

            totalStockGuids:
                stockGuids.length,

            totalStocksImported:
                importedStocks.length,

            requestedUniqueGuids:
                requestedGuidSet.size,

            returnedUniqueGuids:
                returnedGuidSet.size,

            missingGuidCount:
                missingGuids.length,

            duplicateReturnedGuidCount:
                duplicateReturnedGuids.length,

            missingGuids,

            duplicateReturnedGuids,

            requestedGuids:
                stockGuids,

            returnedStocks,

            success:
                requestedGuidSet.size ===
                returnedGuidSet.size
                &&
                missingGuids.length === 0
                &&
                duplicateReturnedGuids.length === 0

        };


        // ============================================
        // STEP 6
        // Save latest result
        // ============================================

        fs.writeFileSync(

            logFile,

            JSON.stringify(
                result,
                null,
                2
            ),

            "utf8"

        );


        console.log("================================");

        console.log(
            `Tally Stock GUIDs: ${stockGuids.length}`
        );

        console.log(
            `Imported Stocks: ${importedStocks.length}`
        );

        console.log(
            `Missing GUIDs: ${missingGuids.length}`
        );

        console.log(
            `Duplicate Returned GUIDs: ${duplicateReturnedGuids.length}`
        );

        console.log(
            `Result: ${
                result.success
                    ? "PASS"
                    : "CHECK REQUIRED"
            }`
        );

        console.log(
            "Result file:",
            logFile
        );

        console.log("================================");


    }
    catch (err) {

        const errorResult = {

            test:
                "STOCK TOTAL GUID",

            company,

            success:
                false,

            error:
                err.message,

            stack:
                err.stack

        };


        fs.writeFileSync(

            logFile,

            JSON.stringify(
                errorResult,
                null,
                2
            ),

            "utf8"

        );


        console.error(
            "STOCK TOTAL GUID TEST FAILED"
        );

        console.error(
            err
        );

        console.error(
            "Result file:",
            logFile
        );

    }

})();