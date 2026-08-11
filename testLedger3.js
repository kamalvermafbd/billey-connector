const fs = require("fs");
const path = require("path");

const {
    importLedgers
} = require("./src/tally/ledgerImportService");

const {
    importLedgerBulkByGuid
} = require("./src/tally/ledgerImportServiceBulkGuid");


(async () => {

    const company =
        "Guru Kirpa Trading";

    const lastLedgerAlterId =
        3500;

    const logFile =
        path.join(
            __dirname,
            "src",
            "logs",
            "ledgerAlterIdBulkGuidTestResult.log"
        );


    try {

        console.log("================================");
        console.log("LEDGER ALTERID → BULK GUID TEST");
        console.log("================================");

        console.log(
            "Company:",
            company
        );

        console.log(
            "Baseline AlterID:",
            lastLedgerAlterId
        );


        // ============================================
        // STEP 1
        // AlterID ke base par changed Ledgers lao
        // ============================================

        const changedLedgers =
            await importLedgers({

                company,

                booksBeginningFrom:
                    null,

                lastLedgerAlterId

            });


        console.log(
            "Changed Ledgers:",
            changedLedgers.length
        );


        // ============================================
        // STEP 2
        // Returned Ledgers se GUIDs nikalo
        // ============================================

        const changedLedgerGuids =
            changedLedgers
                .map(
                    ledger =>
                        ledger.guid
                )
                .filter(Boolean);


        console.log(
            "Changed Ledger GUIDs:",
            changedLedgerGuids.length
        );


        console.log(
            "GUIDs:",
            changedLedgerGuids
        );


        // ============================================
        // STEP 3
        // Existing Bulk GUID Pipeline
        // 50 GUID Level-1
        // ============================================

        let importedLedgers = [];


        if (changedLedgerGuids.length > 0) {

            importedLedgers =
                await importLedgerBulkByGuid({

                    company,

                    ledgerGuids:
                        changedLedgerGuids

                });

        }


        console.log(
            "Bulk Imported Ledgers:",
            importedLedgers.length
        );


        // ============================================
        // STEP 4
        // Result
        // ============================================

        const result = {

            test:
                "LEDGER ALTERID → BULK GUID",

            company,

            baselineAlterId:
                lastLedgerAlterId,

            changedLedgers:
                changedLedgers.length,

            changedLedgerGuids:
                changedLedgerGuids.length,

            bulkImportedLedgers:
                importedLedgers.length,

            requestedGuids:
                changedLedgerGuids,

            changedLedgerRecords:
                changedLedgers,

            importedLedgerRecords:
                importedLedgers,

            success:
                changedLedgerGuids.length ===
                importedLedgers.length

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
            "LEDGER ALTERID BULK GUID TEST COMPLETED"
        );

        console.log(
            `Baseline AlterID: ${lastLedgerAlterId}`
        );

        console.log(
            `Changed: ${changedLedgers.length}`
        );

        console.log(
            `GUIDs: ${changedLedgerGuids.length}`
        );

        console.log(
            `Bulk Imported: ${importedLedgers.length}`
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
                "LEDGER ALTERID → BULK GUID",

            company,

            baselineAlterId:
                lastLedgerAlterId,

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
            "LEDGER ALTERID BULK GUID TEST FAILED"
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