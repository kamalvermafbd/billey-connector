const fs = require("fs");
const path = require("path");

const {
    importLedgerGuids
} = require("./src/tally/ledgerGuidImportService");

const {
    importLedgerBulkByGuid
} = require("./src/tally/ledgerImportServiceBulkGuid");


(async () => {

    const company =
        "Guru Kirpa Trading";


    const logFile =
        path.join(
            __dirname,
            "src",
            "logs",
            "ledgerGuidBatchTestResult.json"
        );


    try {

        // ============================================
        // STEP 1: Actual Ledger GUIDs from Tally
        // ============================================

        const ledgerGuids =
            await importLedgerGuids({
                company
            });


        console.log(
            "TOTAL LEDGER GUIDS:",
            ledgerGuids.length
        );


        // ============================================
        // STEP 2: FIRST 50 GUIDs only
        // ============================================

        const firstBatch =
            ledgerGuids.slice(
                0,
                50
            );


        // ============================================
        // STEP 3: Import those 50 Ledgers
        // ============================================

        const ledgers =
            await importLedgerBulkByGuid({
                company,
                ledgerGuids: firstBatch
            });


        // ============================================
        // STEP 4: Verification details
        // ============================================

        const returnedLedgers =
            ledgers.map(ledger => ({

                masterId:
                    ledger.masterId,

                alterId:
                    ledger.alterId,

                guid:
                    ledger.guid,

                name:
                    ledger.name,

                parent:
                    ledger.parent,

                parentGroupGuid:
                    ledger.parentGroupGuid,

                parentGroupMasterId:
                    ledger.parentGroupMasterId,

                parentGroupAlterId:
                    ledger.parentGroupAlterId

            }));


        // ============================================
        // STEP 5: Save result
        // ============================================

        const result = {

            test:
                "LEDGER GUID BATCH",

            company,

            totalLedgerGuids:
                ledgerGuids.length,

            firstBatchRequested:
                firstBatch.length,

            requestedGuids:
                firstBatch,

            ledgersReturned:
                ledgers.length,

            returnedLedgers,

            success:
                ledgers.length > 0

        };


        fs.writeFileSync(

            logFile,

            JSON.stringify(
                result,
                null,
                2
            ),

            "utf8"

        );


        console.log(
            "LEDGER GUID TEST COMPLETED"
        );

        console.log(
            `Total GUIDs: ${ledgerGuids.length} | Requested: ${firstBatch.length} | Returned: ${ledgers.length}`
        );

        console.log(
            "Result:",
            logFile
        );


    }
    catch (err) {

        const errorResult = {

            test:
                "LEDGER GUID BATCH",

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
            "LEDGER GUID TEST FAILED"
        );

        console.error(
            err.message
        );

        console.error(
            "Result:",
            logFile
        );

    }

})();