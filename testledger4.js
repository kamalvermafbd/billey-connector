const {
    sendToTally
} = require("./src/tally/tallyService");

const {
    importCompany
} = require("./src/tally/companyImportService");

const {
    buildLedgerRequest
} = require("./src/tally/ledgerRequest");

const { XMLParser } =
    require("fast-xml-parser");

const fs = require("fs");

const COMPANY = "Sunil Ent(Client";
const LEDGER_NAME = "RB Computers";

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    parseTagValue: true,
    trimValues: true
});

async function test() {

    console.log("======================================");
    console.log("LEDGER CREDIT PERIOD TEST");
    console.log("COMPANY :", COMPANY);
    console.log("LEDGER  :", LEDGER_NAME);
    console.log("======================================");

    // ======================================
    // GET ACTUAL BOOKS BEGINNING
    // ======================================

    const companyData =
        await importCompany({
            company: COMPANY
        });

    const booksBeginningFrom =
        companyData.booksBeginningFrom;

    console.log("COMPANY FROM TALLY :",
        companyData.companyName);

    console.log("BOOKS BEGINNING FROM :",
        booksBeginningFrom);

    if (!booksBeginningFrom) {
        throw new Error(
            "BOOKSFROM missing from importCompany"
        );
    }

    // ======================================
    // BUILD EXACT MAIN LEDGER REQUEST
    // ======================================

    const xml =
        buildLedgerRequest({
            company: COMPANY,
            booksBeginningFrom
        });

    fs.writeFileSync(
        "./ledger-credit-period-test-request.xml",
        xml,
        "utf8"
    );

    console.log(
        "Sending MAIN ledgerRequest.js request..."
    );

    // ======================================
    // SEND TO TALLY
    // ======================================

    const response =
        await sendToTally(xml);

    fs.writeFileSync(
        "./ledger-credit-period-test-response.xml",
        String(response),
        "utf8"
    );

    // ======================================
    // PARSE
    // ======================================

    const json =
        parser.parse(response);

    const collection =
        json
            ?.ENVELOPE
            ?.BODY
            ?.DATA
            ?.COLLECTION;

    const ledgers = collection?.LEDGER;

    // ======================================
    // HANDLE SINGLE / MULTIPLE LEDGER
    // ======================================

    const ledger =
        Array.isArray(ledgers)
            ? ledgers.find(
                l => l?.NAME === LEDGER_NAME
            )
            : ledgers;

    console.log(
        "======================================"
    );

    console.log(
        "RAW TALLY RESULT"
    );

    console.dir(
        ledger,
        {
            depth: null
        }
    );

    console.log(
        "======================================"
    );

    // ======================================
    // EXTRACT CREDIT PERIOD
    // ======================================

    const creditPeriod =
        ledger?.BILLCREDITPERIOD?.["#text"]
        ??
        ledger?.BILLCREDITPERIOD
        ??
        null;

    console.log(
        "======================================"
    );

    console.log(
        "LEDGER CREDIT PERIOD :",
        creditPeriod
    );

    console.log(
        "======================================"
    );

    // ======================================
    // FINAL CONFIRMATION
    // ======================================

    if (
        String(creditPeriod)
            .trim()
            .toLowerCase() === "120 days"
    ) {

        console.log(
            "✅ CONFIRMED: RB Computers credit period = 120 Days"
        );

    } else {

        console.log(
            "❌ NOT CONFIRMED"
        );

        console.log(
            "Expected : 120 Days"
        );

        console.log(
            "Received :",
            creditPeriod
        );
    }
}

test().catch(error => {

    console.error(
        "LEDGER CREDIT PERIOD TEST FAILED"
    );

    console.error(error);

});