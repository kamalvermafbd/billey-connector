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
        "20260331";

    const logFile =
        path.join(
            __dirname,
            "src",
            "logs",
            "voucherMetadataTestResult.json"
        );


    try {

        console.log("================================");
        console.log("VOUCHER GUID + MASTERID + ALTERID TEST");
        console.log("================================");

        console.log(
            "Company:",
            company
        );

        console.log(
            "Date Range:",
            fromDate,
            "→",
            toDate
        );


        // ============================================
        // IMPORT VOUCHER RECORDS
        // ============================================

        const voucherRecords =
            await importVoucherGuids({

                company,

                fromDate,

                toDate

            });


        // ============================================
        // METADATA CHECK
        // ============================================

        const records =
            voucherRecords.map(voucher => ({

                guid:
                    voucher.guid
                    ?? null,

                masterid:
                    voucher.masterid
                    ?? voucher.masterId
                    ?? voucher.master_id
                    ?? null,

                alterid:
                    voucher.alterid
                    ?? voucher.alterId
                    ?? voucher.alter_id
                    ?? null

            }));


        const guidCount =
            records.filter(
                row => row.guid
            ).length;


        const masterIdCount =
            records.filter(
                row => row.masterid != null
            ).length;


        const alterIdCount =
            records.filter(
                row => row.alterid != null
            ).length;


        const completeRecords =
            records.filter(
                row =>
                    row.guid &&
                    row.masterid != null &&
                    row.alterid != null
            );


        const incompleteRecords =
            records.filter(
                row =>
                    !row.guid ||
                    row.masterid == null ||
                    row.alterid == null
            );


        const uniqueGuids =
            new Set(
                records
                    .map(row => row.guid)
                    .filter(Boolean)
            );


        // ============================================
        // RESULT
        // ============================================

        const result = {

            test:
                "VOUCHER GUID + MASTERID + ALTERID",

            company,

            fromDate,

            toDate,


            totalVoucherRecords:
                records.length,


            uniqueVoucherGuids:
                uniqueGuids.size,


            guidPresent:
                guidCount,


            masterIdPresent:
                masterIdCount,


            alterIdPresent:
                alterIdCount,


            completeRecords:
                completeRecords.length,


            incompleteRecords:
                incompleteRecords.length,


            success:
                incompleteRecords.length === 0,


            // ----------------------------------------
            // ALL RECORDS
            // ----------------------------------------

            records,


            // ----------------------------------------
            // ONLY INCOMPLETE RECORDS
            // ----------------------------------------

            incompleteVoucherRecords:
                incompleteRecords

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


        // ============================================
        // CONSOLE
        // ============================================

        console.log("================================");

        console.log(
            "Total Voucher Records:",
            records.length
        );

        console.log(
            "Unique Voucher GUIDs:",
            uniqueGuids.size
        );

        console.log(
            "GUID Present:",
            guidCount
        );

        console.log(
            "MasterID Present:",
            masterIdCount
        );

        console.log(
            "AlterID Present:",
            alterIdCount
        );

        console.log(
            "Complete Records:",
            completeRecords.length
        );

        console.log(
            "Incomplete Records:",
            incompleteRecords.length
        );

        console.log(
            "Result:",
            result.success
                ? "PASS"
                : "CHECK REQUIRED"
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
                "VOUCHER GUID + MASTERID + ALTERID",

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

            logFile,

            JSON.stringify(
                errorResult,
                null,
                2
            ),

            "utf8"

        );


        console.error(
            "VOUCHER METADATA TEST FAILED"
        );

        console.error(err);

    }

})();