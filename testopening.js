// testopening.js

const {
    sendToTally
} = require("./src/tally/tallyService");

const {
    XMLParser
} = require("fast-xml-parser");

const {
    parseLedgerResponse
} = require("./src/tally/ledgerParser");

const fs = require("fs");


// ==========================================
// TEST CONFIG
// ==========================================

const COMPANY = "Sunil Ent(Client";
const LEDGER_NAME = "Rahul Trading";

const BOOKS_BEGINNING_FROM = "2021-04-01";


const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    parseTagValue: true,
    trimValues: true
});


// ==========================================
// BUILD TEST XML
// ==========================================

function buildTestXml({
    company,
    booksBeginningFrom
}) {

    return `
<ENVELOPE>

    <HEADER>

        <VERSION>1</VERSION>

        <TALLYREQUEST>Export</TALLYREQUEST>

        <TYPE>Collection</TYPE>

        <ID>OpeningBillWiseTest</ID>

    </HEADER>

    <BODY>

        <DESC>

            <STATICVARIABLES>

                <SVCURRENTCOMPANY>
                    ${company}
                </SVCURRENTCOMPANY>

                <SVEXPORTFORMAT>
                    $$SysName:XML
                </SVEXPORTFORMAT>

                <SVFROMDATE TYPE="Date">
                    ${booksBeginningFrom}
                </SVFROMDATE>

                <SVTODATE TYPE="Date">
                    ${booksBeginningFrom}
                </SVTODATE>

            </STATICVARIABLES>

            <TDL>

                <TDLMESSAGE>

                    <COLLECTION
                        NAME="OpeningBillWiseTest">

                        <TYPE>Ledger</TYPE>

                        <FILTER>
                            OpeningBillWiseTestFilter
                        </FILTER>

                        <FETCH>

                            NAME,
                            GUID,
                            MASTERID,
                            ALTERID,

                            PARENT,

                            OPENINGBALANCE,
                            OPENINGBALANCEON,

                            ISBILLWISEON,

                            BILLALLOCATIONS.LIST,

                            BILLALLOCATIONS.LIST.NAME,
                            BILLALLOCATIONS.LIST.BILLTYPE,
                            BILLALLOCATIONS.LIST.AMOUNT,
                            BILLALLOCATIONS.LIST.BILLDATE,
                            BILLALLOCATIONS.LIST.DUEDATE,
                            BILLALLOCATIONS.LIST.CREDITPERIOD

                        </FETCH>

                    </COLLECTION>


                    <SYSTEM
                        TYPE="Formulae"
                        NAME="OpeningBillWiseTestFilter">

                        $NAME = "${LEDGER_NAME}"

                    </SYSTEM>

                </TDLMESSAGE>

            </TDL>

        </DESC>

    </BODY>

</ENVELOPE>
`;
}


// ==========================================
// TEST
// ==========================================

async function test() {

    console.log(
        "======================================"
    );

    console.log(
        "OPENING BILL-WISE TEST"
    );

    console.log(
        "COMPANY :",
        COMPANY
    );

    console.log(
        "LEDGER  :",
        LEDGER_NAME
    );

    console.log(
        "BOOKS BEGINNING FROM :",
        BOOKS_BEGINNING_FROM
    );

    console.log(
        "======================================"
    );


    // ======================================
    // BUILD REQUEST
    // ======================================

    const xml =
        buildTestXml({

            company:
                COMPANY,

            booksBeginningFrom:
                BOOKS_BEGINNING_FROM

        });


    fs.writeFileSync(
        "./opening-bill-wise-test-request.xml",
        xml,
        "utf8"
    );


    console.log(
        "Sending opening bill-wise request..."
    );


    // ======================================
    // SEND TO TALLY
    // ======================================

    const response =
        await sendToTally(xml);


    fs.writeFileSync(
        "./opening-bill-wise-test-response.xml",
        String(response),
        "utf8"
    );


    // ======================================
    // RAW RESPONSE
    // ======================================

    console.log(
        "======================================"
    );

    console.log(
        "RAW TALLY RESPONSE"
    );

    console.log(
        String(response)
    );

    console.log(
        "======================================"
    );


    // ======================================
    // PARSE
    // ======================================

    const json =
        parser.parse(response);

    const parsedLedgers = parseLedgerResponse(response);

    const parsedSudhir =
        parsedLedgers.find(
            x => x.name === LEDGER_NAME
        );

    console.log(
        "======================================"
    );

    console.log(
        "PARSED OPENING BILL ALLOCATIONS"
    );

    console.dir(
        parsedSudhir?.openingBillAllocations,
        {
            depth: null
        }
    );

    console.log(
        "======================================"
    );


    const ledger =
        json
            ?.ENVELOPE
            ?.BODY
            ?.DATA
            ?.COLLECTION
            ?.LEDGER;


    // ======================================
    // RESULT
    // ======================================

    console.log(
        "======================================"
    );

    console.log(
        "PARSED LEDGER RESULT"
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
    // SPECIFIC OPENING DATA
    // ======================================

    if (!ledger) {

        console.log(
            "NO LEDGER RETURNED"
        );

        return;
    }


    console.log(
        "LEDGER NAME :",
        ledger.NAME
    );

    console.log(
        "OPENING BALANCE :",
        ledger.OPENINGBALANCE
    );

    console.log(
        "OPENING BALANCE ON :",
        ledger.OPENINGBALANCEON
    );

    console.log(
        "IS BILL WISE ON :",
        ledger.ISBILLWISEON
    );


    console.log(
        "======================================"
    );

    console.log(
        "BILL ALLOCATIONS"
    );

    console.dir(
        ledger["BILLALLOCATIONS.LIST"],
        {
            depth: null
        }
    );

    console.log(
        "======================================"
    );

}


test().catch(error => {

    console.error(
        "OPENING BILL-WISE TEST FAILED"
    );

    console.error(error);

});