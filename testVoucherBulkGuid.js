const fs = require("fs");
const path = require("path");

const {
    importVoucherBulkByGuid
} = require("./src/tally/voucherImportServiceBulkGuid");

(async () => {

    const company =
        "Guru Kirpa Trading";

    const guidFile =
        path.join(
            __dirname,
            "src",
            "logs",
            "voucherLevel1GuidDiscovery.json"
        );

    const summaryFile =
        path.join(
            __dirname,
            "src",
            "logs",
            "voucherBulkGuidTest.log"
        );

    try {

        console.log(
            "======================================"
        );

        console.log(
            "VOUCHER BULK GUID TEST"
        );

        console.log(
            "======================================"
        );

        console.log(
            "Company:",
            company
        );

        console.log(
            "GUID File:",
            guidFile
        );

        // ============================================
        // READ LEVEL-1 GUID DISCOVERY FILE
        // ============================================

        if (!fs.existsSync(guidFile)) {

            throw new Error(
                `GUID discovery file not found: ${guidFile}`
            );

        }

        const voucherRecords =
            JSON.parse(
                fs.readFileSync(
                    guidFile,
                    "utf8"
                )
            );

        if (!Array.isArray(voucherRecords)) {

            throw new Error(
                "GUID discovery file does not contain an array."
            );

        }

        // ============================================
        // EXTRACT GUIDS
        // ============================================

        const voucherGuids =
            voucherRecords
                .map(
                    row =>
                        row &&
                        row.guid
                )
                .filter(Boolean);

        const uniqueGuids =
            [
                ...new Set(
                    voucherGuids
                )
            ];

        console.log(
            "======================================"
        );

        console.log(
            "GUID DISCOVERY INPUT"
        );

        console.log(
            "Records in file:",
            voucherRecords.length
        );

        console.log(
            "GUIDs:",
            voucherGuids.length
        );

        console.log(
            "Unique GUIDs:",
            uniqueGuids.length
        );

        console.log(
            "======================================"
        );

        if (!uniqueGuids.length) {

            throw new Error(
                "No GUIDs found in discovery file."
            );

        }

        // ============================================
        // BULK GUID IMPORT
        // ============================================

        const startedAt =
            Date.now();

        const vouchers =
            await importVoucherBulkByGuid({

                company,

                voucherGuids:
                    uniqueGuids

            });

        const elapsedMs =
            Date.now() - startedAt;

        // ============================================
        // RESULT
        // ============================================

        const result = {

            test:
                "VOUCHER BULK GUID",

            company,

            inputRecords:
                voucherRecords.length,

            inputGuids:
                voucherGuids.length,

            uniqueInputGuids:
                uniqueGuids.length,

            vouchersReturned:
                vouchers.length,

            elapsedMs,

            elapsedSeconds:
                Number(
                    (
                        elapsedMs / 1000
                    ).toFixed(2)
                ),

            guidFile,

            success:
                uniqueGuids.length > 0 &&
                vouchers.length > 0

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
            "VOUCHER BULK GUID RESULT"
        );

        console.log(
            "======================================"
        );

        console.log(
            "Input GUIDs:",
            uniqueGuids.length
        );

        console.log(
            "Vouchers Returned:",
            vouchers.length
        );

        console.log(
            "Elapsed:",
            `${result.elapsedSeconds} seconds`
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
                "VOUCHER BULK GUID",

            company,

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
            "VOUCHER BULK GUID TEST FAILED"
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