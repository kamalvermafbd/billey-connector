const fs = require("fs");
const path = require("path");

const {
    importCostCentreGuids
} = require("./src/tally/costCentreGuidImportService");

const {
    importCostCentres
} = require("./src/tally/costCentreImportService");


(async () => {

    const company =
        "Guru Kirpa Trading";


    const logFile =
        path.join(
            __dirname,
            "src",
            "logs",
            "costCentreTotalTestResult.json"
        );


    try {

        console.log("================================");
        console.log("COST CENTRE TOTAL TEST");
        console.log("================================");

        console.log(
            "Company:",
            company
        );


        // ============================================
        // STEP 1
        // Tally se ALL Cost Centre GUIDs
        // ============================================

        const costCentreGuids =
            await importCostCentreGuids({
                company
            });


        console.log(
            "Total Cost Centre GUIDs:",
            costCentreGuids.length
        );


        // ============================================
        // STEP 2
        // Actual Cost Centre import
        // ============================================

        const costCentres =
            await importCostCentres({
                company
            });


        console.log(
            "Total Cost Centres Imported:",
            costCentres.length
        );


        // ============================================
        // STEP 3
        // GUID verification
        // ============================================

        const requestedGuidSet =
            new Set(
                costCentreGuids
                    .map(cc => cc.guid)
                    .filter(Boolean)
            );


        const returnedGuidSet =
            new Set(
                costCentres
                    .map(cc => cc.guid)
                    .filter(Boolean)
            );


        const missingGuids =
            [...requestedGuidSet]
                .filter(
                    guid =>
                        !returnedGuidSet.has(guid)
                );


        const duplicateReturnedGuids =
            costCentres
                .map(cc => cc.guid)
                .filter(Boolean)
                .filter(
                    (guid, index, array) =>
                        array.indexOf(guid) !== index
                );


        // ============================================
        // STEP 4
        // Details for verification
        // ============================================

        const returnedCostCentres =
            costCentres.map(cc => ({

                name:
                    cc.name,

                guid:
                    cc.guid,

                masterId:
                    cc.masterid,

                alterId:
                    cc.alterid,

                parent:
                    cc.parent,

                category:
                    cc.category,

                reservedName:
                    cc.reservedName

            }));


        // ============================================
        // STEP 5
        // Final result
        // ============================================

        const result = {

            test:
                "COST CENTRE TOTAL",

            company,

            totalCostCentreGuids:
                costCentreGuids.length,

            totalCostCentresImported:
                costCentres.length,

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
                costCentreGuids,

            returnedCostCentres,

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
            `Tally Cost Centre GUIDs: ${costCentreGuids.length}`
        );

        console.log(
            `Imported Cost Centres: ${costCentres.length}`
        );

        console.log(
            `Missing GUIDs: ${missingGuids.length}`
        );

        console.log(
            `Duplicate GUIDs: ${duplicateReturnedGuids.length}`
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
                "COST CENTRE TOTAL",

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
            "COST CENTRE TOTAL TEST FAILED"
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