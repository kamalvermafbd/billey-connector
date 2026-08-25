const {
    sendToTally
} = require("./src/tally/tallyService");

const {
    importCompany
} = require("./src/tally/companyImportService");

const { XMLParser } =
    require("fast-xml-parser");

const fs = require("fs");

const COMPANY = "Guru Kirpa Trading";
const LEDGER_NAME = "NEW TECH CHEMICALS";


const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    parseTagValue: true,
    trimValues: true
});


// ==========================================
// BUILD LEDGER REQUEST
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

        <ID>LedgerOpeningTest</ID>

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
                        NAME="LedgerOpeningTest">

                        <TYPE>Ledger</TYPE>

                        <FILTER>
                            LedgerOpeningTestFilter
                        </FILTER>

                        <FETCH>

                            NAME,
                            GUID,
                            MASTERID,
                            ALTERID,
                            OPENINGBALANCE,
                            OPENINGBALANCEON

                        </FETCH>

                    </COLLECTION>


                    <SYSTEM
                        TYPE="Formulae"
                        NAME="LedgerOpeningTestFilter">

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
        "LEDGER OPENING BALANCE TEST"
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
        "======================================"
    );


    // ======================================
    // GET ACTUAL BOOKS BEGINNING
    // FROM EXISTING COMPANY FLOW
    // ======================================

    const companyData =
        await importCompany({
            company: COMPANY
        });


    const booksBeginningFrom =
        companyData.booksBeginningFrom;


    console.log(
        "======================================"
    );

    console.log(
        "COMPANY FROM TALLY :",
        companyData.companyName
    );

    console.log(
        "BOOKS BEGINNING FROM :",
        booksBeginningFrom
    );

    console.log(
        "======================================"
    );


    if (!booksBeginningFrom) {

        throw new Error(
            "BOOKSFROM missing from importCompany"
        );

    }


    // ======================================
    // COMPANY ALREADY SELECTED BY
    // importCompany()
    // ======================================

    const xml =
        buildTestXml({

            company:
                COMPANY,

            booksBeginningFrom

        });


    fs.writeFileSync(
        "./ledger-opening-test-request.xml",
        xml,
        "utf8"
    );


    console.log(
        "Sending ledger request with BOOKSFROM:",
        booksBeginningFrom
    );


    const response =
        await sendToTally(xml);


    fs.writeFileSync(
        "./ledger-opening-test-response.xml",
        String(response),
        "utf8"
    );


    const json =
        parser.parse(response);


    const ledger =
        json
            ?.ENVELOPE
            ?.BODY
            ?.DATA
            ?.COLLECTION
            ?.LEDGER;


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

}


test().catch(error => {

    console.error(
        "LEDGER OPENING TEST FAILED"
    );

    console.error(error);

});