const {
    sendToTally,
    selectCompany
} = require("./src/tally/tallyService");

const {
    buildVoucherBulkGuidRequest
} = require("./src/tally/voucherBulkGuidRequest");

const fs = require("fs");

(async () => {

    const company =
        "Guru Kirpa Trading";

    const voucherGuid =
        "b06ee43a-c023-4bfc-b8d9-3fd85283e679-00002b6d";

    try {

        await selectCompany(company);

        const requestXml =
            buildVoucherBulkGuidRequest({
                company,
                voucherGuids: [
                    voucherGuid
                ]
            });


        // ============================================
        // SAVE REQUEST XML
        // ============================================

        fs.writeFileSync(
            "./bulk-guid-request.xml",
            requestXml,
            "utf8"
        );


        // ============================================
        // SEND TO TALLY
        // ============================================

        const responseXml =
            await sendToTally(requestXml);


        // ============================================
        // SAVE RAW RESPONSE
        // ============================================

        fs.writeFileSync(
            "./bulk-guid-response.xml",
            String(responseXml || ""),
            "utf8"
        );


        // ============================================
        // SAVE RESULT SUMMARY
        // ============================================

        fs.writeFileSync(
            "./bulk-guid-result.json",
            JSON.stringify(
                {
                    timestamp:
                        new Date().toISOString(),

                    company,

                    voucherGuid,

                    responseBytes:
                        Buffer.byteLength(
                            String(responseXml || ""),
                            "utf8"
                        ),

                    hasVoucher:
                        String(responseXml || "")
                            .includes("<VOUCHER>")

                },
                null,
                2
            )
        );


    } catch (err) {

        fs.writeFileSync(
            "./bulk-guid-error.json",
            JSON.stringify(
                {
                    timestamp:
                        new Date().toISOString(),

                    company,

                    voucherGuid,

                    error:
                        err.stack || String(err)

                },
                null,
                2
            )
        );

        process.exitCode = 1;

    }

})();