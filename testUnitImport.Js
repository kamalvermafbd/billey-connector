const fs = require("fs");
const path = require("path");

const {
    importUnitGuids
} = require("./src/tally/unitGuidImportService");

const {
    importUnits
} = require("./src/tally/unitImportService");


(async () => {

    const company =
        "Guru Kirpa Trading";


    const logFile =
        path.join(
            __dirname,
            "src",
            "logs",
            "unitTotalTestResult.json"
        );


    try {

        console.log("================================");
        console.log("UNIT TOTAL TEST");
        console.log("================================");

        console.log(
            "Company:",
            company
        );


        // ============================================
        // STEP 1
        // Actual Unit GUIDs from Tally
        // ============================================

        const unitGuids =
            await importUnitGuids({
                company
            });


        console.log(
            "Total Unit GUIDs:",
            unitGuids.length
        );


        // ============================================
        // STEP 2
        // Actual Unit import
        // ============================================

        const units =
            await importUnits({
                company
            });


        console.log(
            "Total Units Imported:",
            units.length
        );


        // ============================================
        // STEP 3
        // GUID verification
        // ============================================

        const requestedGuidSet =
            new Set(
                unitGuids
                    .map(unit => unit.guid)
                    .filter(Boolean)
            );


        const returnedGuidSet =
            new Set(
                units
                    .map(unit => unit.guid)
                    .filter(Boolean)
            );


        const missingGuids =
            [...requestedGuidSet]
                .filter(
                    guid =>
                        !returnedGuidSet.has(guid)
                );


        const duplicateReturnedGuids =
            units
                .map(unit => unit.guid)
                .filter(Boolean)
                .filter(
                    (guid, index, array) =>
                        array.indexOf(guid) !== index
                );


        // ============================================
        // STEP 4
        // Unit verification details
        // ============================================

        const returnedUnits =
            units.map(unit => ({

                name:
                    unit.name,

                guid:
                    unit.guid,

                masterId:
                    unit.masterId,

                alterId:
                    unit.alterId

            }));


        // ============================================
        // STEP 5
        // Result
        // ============================================

        const result = {

            test:
                "UNIT TOTAL",

            company,

            totalUnitGuids:
                unitGuids.length,

            totalUnitsImported:
                units.length,

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
                unitGuids,

            returnedUnits,

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
            `Tally Unit GUIDs: ${unitGuids.length}`
        );

        console.log(
            `Imported Units: ${units.length}`
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
                "UNIT TOTAL",

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
            "UNIT TOTAL TEST FAILED"
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