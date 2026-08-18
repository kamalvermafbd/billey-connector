const {
    sendToTally,
    selectCompany
} = require("./src/tally/tallyService");

const {
    buildDeletedVoucherTestRequest
} = require("./src/tally/deletedVoucherTestRequest");

(async () => {

    const company =
        "Webthaali";

    try {

        console.log(
            "======================================"
        );

        console.log(
            "DELETED VOUCHER TEST"
        );

        console.log(
            "Company:",
            company
        );

        console.log(
            "======================================"
        );

        await selectCompany(company);

        const requestXml =
            buildDeletedVoucherTestRequest({
                company
            });

        console.log(
            "Sending request to Tally..."
        );

        const responseXml =
            await sendToTally(
                requestXml
            );

        console.log(
            "======================================"
        );

        console.log(
            "TALLY RESPONSE"
        );

        console.log(
            "======================================"
        );

        console.log(
            responseXml
        );

    } catch (err) {

        console.error(
            "======================================"
        );

        console.error(
            "DELETED VOUCHER TEST FAILED"
        );

        console.error(
            err.stack
        );

        console.error(
            "======================================"
        );

        process.exitCode = 1;

    }

})();