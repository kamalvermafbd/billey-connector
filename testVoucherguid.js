const fs = require("fs");
const path = require("path");

const {
    importVoucherGuids
} = require("./src/tally/voucherImportService");

(async () => {

    const company =
        "Guru Kirpa Trading";

    const fromDate =
        "20180401";

    const toDate =
        "20270301";

    const logDir =
        path.join(
            __dirname,
            "src",
            "logs"
        );

    const summaryFile =
        path.join(
            logDir,
            "voucherLevel1Test.log"
        );

    const fullGuidFile =
        path.join(
            logDir,
            "voucherLevel1GuidDiscovery.json"
        );

    try {

        console.log(
            "======================================"
        );

        console.log(
            "VOUCHER LEVEL-1 TEST"
        );

        console.log(
            "======================================"
        );

        console.log(
            "Company:",
            company
        );

        console.log(
            "Date:",
            fromDate,
            "→",
            toDate
        );

        const startedAt =
            Date.now();

        // ============================================
        // PRODUCTION FUNCTION
        // ============================================

        const voucherRecords =
            await importVoucherGuids({
                company,
                fromDate,
                toDate
            });

        const elapsedMs =
            Date.now() - startedAt;

        // ============================================
        // BASIC DISCOVERY CHECK
        // ============================================

        const totalRecords =
            voucherRecords.length;

        const guids =
            voucherRecords
                .map(row => row.guid)
                .filter(Boolean);

        const uniqueGuids =
            new Set(
                guids
            ).size;

        const missingGuid =
            voucherRecords.filter(
                row => !row.guid
            ).length;

        const missingMasterId =
            voucherRecords.filter(
                row =>
                    !Number.isFinite(
                        Number(row.masterid)
                    )
            ).length;

        const missingAlterId =
            voucherRecords.filter(
                row =>
                    !Number.isFinite(
                        Number(row.alterid)
                    )
            ).length;

        // ============================================
        // SAVE DISCOVERED RECORDS
        // ============================================

        fs.writeFileSync(

            fullGuidFile,

            JSON.stringify(
                voucherRecords,
                null,
                2
            ),

            "utf8"
        );

        // ============================================
        // RESULT
        // ============================================

        const result = {

            test:
                "VOUCHER LEVEL-1",

            company,

            fromDate,

            toDate,

            totalRecords,

            uniqueGuids,

            duplicateGuids:
                totalRecords -
                uniqueGuids,

            missingGuid,

            missingMasterId,

            missingAlterId,

            elapsedMs,

            fullGuidFile,

            success:
                totalRecords > 0 &&
                uniqueGuids === totalRecords &&
                missingGuid === 0 &&
                missingMasterId === 0 &&
                missingAlterId === 0

        };

        // ============================================
        // SAVE SUMMARY
        // ============================================

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
        // CONSOLE
        // ============================================

        console.log(
            "======================================"
        );

        console.log(
            "Total Voucher Records:",
            totalRecords
        );

        console.log(
            "Unique GUIDs:",
            uniqueGuids
        );

        console.log(
            "Duplicate GUIDs:",
            totalRecords -
            uniqueGuids
        );

        console.log(
            "Missing GUID:",
            missingGuid
        );

        console.log(
            "Missing MASTERID:",
            missingMasterId
        );

        console.log(
            "Missing ALTERID:",
            missingAlterId
        );

        console.log(
            "Elapsed:",
            `${elapsedMs} ms`
        );

        console.log(
            "Full GUID File:",
            fullGuidFile
        );

        console.log(
            "Summary File:",
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
                "VOUCHER LEVEL-1",

            company,

            fromDate,

            toDate,

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
            "VOUCHER LEVEL-1 TEST FAILED"
        );

        console.error(
            err.stack
        );

        console.error(
            "======================================"
        );

        console.error(
            "Summary File:",
            summaryFile
        );

        process.exitCode = 1;
    }

})();