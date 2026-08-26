const {
    sendToTally
} = require("./src/tally/tallyService");

const {
    importCompany
} = require("./src/tally/companyImportService");

const fs = require("fs");

const COMPANY = "Guru Kirpa Trading";


// ==========================================
// PARSE GODOWN-WISE STOCK
// ==========================================

function parseGodownWiseStock(response) {

    const xmlText =
        String(response);


    const itemBlocks =
        xmlText.match(
            /<DSPACCNAME>[\s\S]*?(?=<DSPACCNAME>|<\/ENVELOPE>)/g
        ) || [];


    const godownStock = [];


    for (const block of itemBlocks) {

        const itemNameMatch =
            block.match(
                /<DSPDISPNAME>([\s\S]*?)<\/DSPDISPNAME>/
            );


        if (!itemNameMatch) {
            continue;
        }


        const stockItemName =
            itemNameMatch[1]
                .replace(/&amp;/g, "&")
                .replace(/&quot;/g, '"')
                .trim();


        const godownMatches =
            [
                ...block.matchAll(
                    /<SSGODOWN>([\s\S]*?)<\/SSGODOWN>[\s\S]*?<DSPCLQTY>([\s\S]*?)<\/DSPCLQTY>/g
                )
            ];


        for (const match of godownMatches) {

            const godownName =
                match[1].trim();


            const closingBalance =
                match[2].trim();


            const qtyMatch =
                closingBalance.match(
                    /^(-?\d+(?:\.\d+)?)\s*(.*)$/
                );


            if (!qtyMatch) {
                continue;
            }


            godownStock.push({

                stockItemName,

                godownName,

                closingQuantity:
                    Number(qtyMatch[1]),

                unit:
                    qtyMatch[2].trim()

            });

        }

    }


    return godownStock;
}


// ==========================================
// BUILD STOCK SUMMARY REQUEST
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

        <TYPE>Data</TYPE>

        <ID>Stock Summary</ID>

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


                <EXPLODEFLAG>
                    Yes
                </EXPLODEFLAG>


                <ISITEMWISE>
                    Yes
                </ISITEMWISE>


                <SHOWGODOWN>
                    Yes
                </SHOWGODOWN>


                <SHOWBATCHES>
                    Yes
                </SHOWBATCHES>


                <SVFROMDATE TYPE="Date">
                    ${booksBeginningFrom}
                </SVFROMDATE>


                <SVTODATE TYPE="Date">
                    20991231
                </SVTODATE>


                <SVCURRENTDATE TYPE="Date">
                    20991231
                </SVCURRENTDATE>

            </STATICVARIABLES>


            <TDL>

                <TDLMESSAGE>

                    <REPORT NAME="Stock Summary">

                        <VARIABLE>
                            EXPLODEFLAG,
                            SHOWGODOWN,
                            ISITEMWISE
                        </VARIABLE>


                        <SET>
                            EXPLODEFLAG : Yes
                        </SET>


                        <SET>
                            SHOWGODOWN : Yes
                        </SET>


                        <SET>
                            ISITEMWISE : Yes
                        </SET>

                    </REPORT>

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
        "STOCK SUMMARY TEST"
    );

    console.log(
        "COMPANY :",
        COMPANY
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

            company:
                COMPANY

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
    // BUILD REQUEST
    // ======================================

    const xml =
        buildTestXml({

            company:
                COMPANY,

            booksBeginningFrom

        });


    fs.writeFileSync(

        "./stock-summary-test-request.xml",

        xml,

        "utf8"

    );


    console.log(
        "Sending stock summary request with BOOKSFROM:",
        booksBeginningFrom
    );


    // ======================================
    // SEND TO TALLY
    // ======================================

    const response =
        await sendToTally(xml);


    // ======================================
    // SAVE RAW RESPONSE
    // ======================================

    fs.writeFileSync(

        "./stock-summary-test-response.xml",

        String(response),

        "utf8"

    );


    // ======================================
    // PARSE GODOWN-WISE STOCK
    // ======================================

    const godownStock =
        parseGodownWiseStock(response);


    // ======================================
    // PRINT RESULT
    // ======================================

    console.log(
        "======================================"
    );

    console.log(
        "GODOWN-WISE STOCK RESULT"
    );

    console.dir(

        godownStock,

        {
            depth: null
        }

    );


    console.log(
        "TOTAL GODOWN ROWS:",
        godownStock.length
    );

    console.log(
        "======================================"
    );

}


// ==========================================
// RUN TEST
// ==========================================

test().catch(error => {

    console.error(
        "STOCK SUMMARY TEST FAILED"
    );

    console.error(error);

});