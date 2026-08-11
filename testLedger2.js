const fs = require("fs");
const path = require("path");

const {
    importLedgerGuids
} = require("./src/tally/ledgerGuidImportService");

const {
    importLedgerBulkByGuid
} = require("./src/tally/ledgerImportServiceBulkGuid");


(async () => {

    const company = "Guru Kirpa Trading";

    const logFile = path.join(
        __dirname,
        "src",
        "logs",
        "ledgerBulkGuid50TestResult.log"
    );


    try {

        // ============================================
        // STEP 1: Tally se total Ledger GUIDs
        // ============================================

        const allGuidRecords =
            await importLedgerGuids({
                company
            });


        // ============================================
        // STEP 2: First 100 GUIDs test ke liye
        // ============================================

        const testGuids =
            allGuidRecords
                .slice(0, 100)
                .map(item => item.guid);


        console.log(
            `Total GUIDs received: ${allGuidRecords.length}`
        );

        console.log(
            `Test GUIDs selected: ${testGuids.length}`
        );


        // ============================================
        // STEP 3: 100 GUIDs ko Bulk GUID service do
        // Expected: 50 + 50
        // ============================================

        const ledgers =
            await importLedgerBulkByGuid({

                company,

                ledgerGuids:
                    testGuids

            });


        // ============================================
        // STEP 4: Result
        // ============================================

        const result = {

            test:
                "LEDGER BULK GUID LEVEL-1 50",

            company,

            totalGuidRecords:
                allGuidRecords.length,

            testGuidsRequested:
                testGuids.length,

            expectedLevel1Batches:
                Math.ceil(
                    testGuids.length / 50
                ),

            expectedBatchSize:
                50,

            ledgersReturned:
                ledgers.length,

            success:
                ledgers.length > 0,

            requestedGuids:
                testGuids,

            returnedLedgers:
                ledgers

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
            "================================"
        );

        console.log(
            "LEDGER BULK GUID 50 TEST COMPLETED"
        );

        console.log(
            `Total GUIDs: ${allGuidRecords.length}`
        );

        console.log(
            `Requested: ${testGuids.length}`
        );

        console.log(
            `Expected Level-1 batches: ${Math.ceil(testGuids.length / 50)}`
        );

        console.log(
            `Returned: ${ledgers.length}`
        );

        console.log(
            "Result:",
            logFile
        );

        console.log(
            "================================"
        );


    }
    catch (err) {

        console.error(
            "LEDGER BULK GUID 50 TEST FAILED"
        );

        console.error(err);

    }

})();