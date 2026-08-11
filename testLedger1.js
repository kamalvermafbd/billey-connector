const fs = require("fs");
const path = require("path");

const {
    importLedgerGuids
} = require("./src/tally/ledgerGuidImportService");

(async () => {

    const company = "Guru Kirpa Trading";

    const logFile = path.join(
        __dirname,
        "src",
        "logs",
        "ledgerGuidListTestResult.log"
    );

    try {

        // ============================================
        // STEP 1: Tally se COMPLETE Ledger GUID list
        // ============================================

        const ledgerGuids =
            await importLedgerGuids({
                company
            });


        // ============================================
        // STEP 2: Complete result file
        // ============================================

        const result = {

            test:
                "LEDGER TOTAL GUID LIST",

            company,

            totalLedgers:
                ledgerGuids.length,

            ledgerGuids:
                ledgerGuids,

            success:
                ledgerGuids.length > 0

        };


        fs.writeFileSync(

            logFile,

            JSON.stringify(
                result,
                null,
                2
            )

        );


        console.log(
            "Result file generated:",
            logFile
        );

        console.log(
            "LEDGER TOTAL GUID TEST COMPLETED"
        );

        console.log(
            `Total Ledger GUIDs: ${ledgerGuids.length}`
        );


    } catch (err) {

        const errorResult = {

            test:
                "LEDGER TOTAL GUID LIST",

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
            )

        );


        console.error(
            "LEDGER TOTAL GUID TEST FAILED"
        );

        console.error(
            "Result file generated:",
            logFile
        );

    }

})();