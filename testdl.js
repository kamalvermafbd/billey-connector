const {
    sendToTally,
    selectCompany
} = require("./src/tally/tallyService");

const {
    buildDeletedVoucherAlterIdTestRequest
} = require("./src/tally/deletedVoucherAlterIdTestRequest");


(async () => {

    // ============================================
    // TEST SETTINGS
    // ============================================

    const company =
        "Guru Kirpa Trading";

    // Last ALTERID from Billey DB
    const lastAlterId =
        16638;

    // Books Beginning Date obtained from Tally
    const booksBeginningDate =
        20210401;

    // Wide upper date boundary
    const toDate =
        20991231;


    try {

        console.log(
            "======================================"
        );

        console.log(
            "BOOKS BEGINNING DATE ALTERID TEST"
        );

        console.log(
            "Company:",
            company
        );

        console.log(
            "Last ALTERID:",
            lastAlterId
        );

        console.log(
            "Books Beginning Date:",
            booksBeginningDate
        );

        console.log(
            "To Date:",
            toDate
        );

        console.log(
            "======================================"
        );


        // ============================================
        // SELECT TALLY COMPANY
        // ============================================

        await selectCompany(
            company
        );


        // ============================================
        // BUILD TEST REQUEST
        // ============================================

        const requestXml =
            buildDeletedVoucherAlterIdTestRequest({

                company,

                lastAlterId,

                booksBeginningDate,

                toDate

            });


        console.log(
            "======================================"
        );

        console.log(
            "TEST PARAMETERS"
        );

        console.log(
            "======================================"
        );

        console.log(
            "SVFROMDATE:",
            booksBeginningDate
        );

        console.log(
            "SVTODATE:",
            toDate
        );

        console.log(
            "ALTERID CONDITION:",
            `$ALTERID > ${lastAlterId}`
        );

        console.log(
            "DATE CONDITION:",
            `$DATE >= ${booksBeginningDate} AND $DATE <= ${toDate}`
        );

        console.log(
            "======================================"
        );

        console.log(
            "Sending request to Tally..."
        );


        // ============================================
        // SEND TO TALLY
        // ============================================

        const responseXml =
            await sendToTally(
                requestXml
            );


        // ============================================
        // RESPONSE
        // ============================================

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


        console.log(
            "======================================"
        );

        console.log(
            "TEST COMPLETED"
        );

        console.log(
            "======================================"
        );


    } catch (err) {

        console.error(
            "======================================"
        );

        console.error(
            "TEST FAILED"
        );

        console.error(
            "======================================"
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