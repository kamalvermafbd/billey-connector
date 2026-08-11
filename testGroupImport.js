const fs = require("fs");
const path = require("path");

const {
    fetchMasterIdsInBatches
} = require("./src/tally/tallyService");

const {
    importGroups
} = require("./src/tally/groupImportService");


(async () => {

    const company = "Guru Kirpa Trading";

const logFile = path.join(
    __dirname,
    "src",
    "logs",
    "group50BatchTestResult.log"
);

    try {

     

        // ============================================
        // STEP 1: Master IDs ko 50-50 batches mein lo
        // ============================================

        const batches =
            await fetchMasterIdsInBatches({
                company,
                batchSize: 50
            });

        const firstBatch =
            batches[0] || [];


        // ============================================
        // STEP 2: Sirf FIRST 50 IDs test karo
        // ============================================

        const groups =
            await importGroups({
                company,
                masterIds: firstBatch
            });


        // ============================================
        // STEP 3: Complete test result file mein save
        // ============================================

        const result = {

            test: "GROUP 50 MASTER ID BATCH",

            company,

            totalBatches:
                batches.length,

            firstBatchRequested:
                firstBatch.length,

            requestedMasterIds:
                firstBatch,

            groupsReturned:
                groups.length,

            returnedGroups:
                groups,

            success:
                groups.length > 0

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

        // ============================================
        // CONSOLE — ONLY SUMMARY
        // ============================================

        console.log(
            "GROUP 50-ID TEST COMPLETED"
        );

        console.log(
            `Requested: ${firstBatch.length} | Returned: ${groups.length}`
        );

      console.log(
            "Result: src/logs/group50BatchTestResult.log"
        );
    } catch (err) {

        const errorResult = {

            test:
                "GROUP 50 MASTER ID BATCH",

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
            "GROUP 50-ID TEST FAILED"
        );

      console.error(
            "Result: logs/group50BatchTestResult.json"
        );

    }

})();