const fs = require("fs");
const path = require("path");

const {
    importStocks
} = require("./src/tally/stockImportService");

const {
    importStockBulkByGuid
} = require("./src/tally/stockImportServiceBulkGuid");


(async () => {

    const company =
        "Guru Kirpa Trading";

    const lastStockAlterId =
        3500;

    const logFile =
        path.join(
            __dirname,
            "src",
            "logs",
            "stockAlterIdBulkGuidTestResult.log"
        );


    try {

        console.log("================================");
        console.log("STOCK ALTERID → BULK GUID TEST");
        console.log("================================");

        console.log(
            "Company:",
            company
        );

        console.log(
            "Baseline Stock AlterID:",
            lastStockAlterId
        );


        // ============================================
        // STEP 1
        // AlterID se changed Stocks lao
        // ============================================

        const changedStocks =
            await importStocks({

                company,

                lastStockAlterId

            });


        console.log(
            "Changed Stocks:",
            changedStocks.length
        );


        // ============================================
        // STEP 2
        // Changed Stocks se GUIDs nikalo
        // ============================================

        const changedStockGuids =
            changedStocks
                .map(
                    stock =>
                        stock.guid
                )
                .filter(Boolean);


        console.log(
            "Changed Stock GUIDs:",
            changedStockGuids.length
        );


        console.log(
            "GUIDs:",
            changedStockGuids
        );


        // ============================================
        // STEP 3
        // Existing Bulk GUID Pipeline
        // 50 GUID Level-1
        // ============================================

        let importedStocks = [];


        if (changedStockGuids.length > 0) {

            importedStocks =
                await importStockBulkByGuid({

                    company,

                    stockGuids:
                        changedStockGuids

                });

        }


        console.log(
            "Bulk Imported Stocks:",
            importedStocks.length
        );


        // ============================================
        // STEP 4
        // Result
        // ============================================

        const result = {

            test:
                "STOCK ALTERID → BULK GUID",

            company,

            baselineAlterId:
                lastStockAlterId,

            changedStocks:
                changedStocks.length,

            changedStockGuids:
                changedStockGuids.length,

            bulkImportedStocks:
                importedStocks.length,

            requestedGuids:
                changedStockGuids,

            changedStockRecords:
                changedStocks,

            importedStockRecords:
                importedStocks,

            success:
                changedStockGuids.length ===
                importedStocks.length

        };


        fs.writeFileSync(

            logFile,

            JSON.stringify(
                result,
                null,
                2
            )

        );


        console.log("================================");
        console.log(
            "STOCK ALTERID BULK GUID TEST COMPLETED"
        );

        console.log(
            `Baseline AlterID: ${lastStockAlterId}`
        );

        console.log(
            `Changed: ${changedStocks.length}`
        );

        console.log(
            `GUIDs: ${changedStockGuids.length}`
        );

        console.log(
            `Bulk Imported: ${importedStocks.length}`
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


    } catch (err) {

        const errorResult = {

            test:
                "STOCK ALTERID → BULK GUID",

            company,

            baselineAlterId:
                lastStockAlterId,

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
            )

        );


        console.error(
            "STOCK ALTERID BULK GUID TEST FAILED"
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