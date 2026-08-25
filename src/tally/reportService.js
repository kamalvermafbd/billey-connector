const {
    sendToTally,
    selectCompany
} = require("./tallyService");

const { XMLParser } = require("fast-xml-parser");
const fs = require("fs");

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    parseTagValue: true,
    trimValues: true
});


// =========================
// TRIAL BALANCE
// =========================

async function getTrialBalance({
    company
}) {

    await selectCompany(company);

    const fromDate = "20260401";
    const asOnDate = "20991201";

    console.log("================================");
    console.log("TRIAL BALANCE TEST");
    console.log("COMPANY :", company);
    console.log("FROM    :", fromDate);
    console.log("TILL    :", asOnDate);
    console.log("================================");

    const xml = `
<ENVELOPE>

    <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Export</TALLYREQUEST>
        <TYPE>Collection</TYPE>
        <ID>Phase3LedgerBalance</ID>
    </HEADER>

    <BODY>

        <DESC>

            <STATICVARIABLES>

                <SVCURRENTCOMPANY>
                    ${company}
                </SVCURRENTCOMPANY>

                <SVFROMDATE TYPE="Date">
                    ${fromDate}
                </SVFROMDATE>

                <SVTODATE TYPE="Date">
                    ${asOnDate}
                </SVTODATE>

                <SVCURRENTDATE TYPE="Date">
                    ${asOnDate}
                </SVCURRENTDATE>

                <SVEXPORTFORMAT>
                    $$SysName:XML
                </SVEXPORTFORMAT>

            </STATICVARIABLES>

            <TDL>

                <TDLMESSAGE>

                    <COLLECTION NAME="Phase3LedgerBalance">

                        <TYPE>Ledger</TYPE>

                        <FETCH>
                            NAME,
                            GUID,
                            PARENT,
                            CLOSINGBALANCE
                        </FETCH>

                    </COLLECTION>

                </TDLMESSAGE>

            </TDL>

        </DESC>

    </BODY>

</ENVELOPE>
`;

    const result =
        await sendToTally(xml);

    fs.writeFileSync(
        "./trial-balance-raw.xml",
        String(result),
        "utf8"
    );

    console.log("TB RAW RESPONSE SAVED");

    const json =
        parser.parse(result);

    const ledgerData =
        json.ENVELOPE?.BODY?.DATA?.COLLECTION?.LEDGER || [];

    const ledgers = Array.isArray(ledgerData)
        ? ledgerData
        : [ledgerData];

    return ledgers.map(ledger => ({
        guid:
            ledger.GUID?.["#text"] ||
            ledger.GUID ||
            "",

        name:
            ledger.NAME ||
            "",

        parent:
            ledger.PARENT?.["#text"] ||
            ledger.PARENT ||
            "",

        closingBalance:
            Number(
                ledger.CLOSINGBALANCE?.["#text"] ||
                ledger.CLOSINGBALANCE ||
                0
            )
    }));
}


// =========================
// LEDGER NATURE TEST
// =========================

async function testLedgerNature({
    company
}) {

    await selectCompany(company);

    const xml = `
<ENVELOPE>

    <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Export</TALLYREQUEST>
        <TYPE>Data</TYPE>
        <ID>LedgerNatureTest</ID>
    </HEADER>

    <BODY>

        <DESC>

            <TDL>

                <TDLMESSAGE>

                    <REPORT NAME="LedgerNatureTest">
                        <FORM>LedgerNatureTestForm</FORM>
                    </REPORT>

                    <FORM NAME="LedgerNatureTestForm">
                        <PART>LedgerNatureTestPart</PART>
                    </FORM>

                    <PART NAME="LedgerNatureTestPart">
                        <LINE>LedgerNatureTestLine</LINE>
                        <REPEAT>
                            LedgerNatureTestLine :
                            LedgerNatureTestCollection
                        </REPEAT>
                    </PART>

                    <LINE NAME="LedgerNatureTestLine">
                        <FIELD>LedgerName</FIELD>
                        <FIELD>ParentName</FIELD>
                        <FIELD>NatureName</FIELD>
                    </LINE>

                    <FIELD NAME="LedgerName">
                        <SET AS>$$String:$Name</SET>
                    </FIELD>

                    <FIELD NAME="ParentName">
                        <SET AS>$$String:$Parent</SET>
                    </FIELD>

                    <FIELD NAME="NatureName">
                        <SET AS>
                            $$String:$NatureOfGroup:Group:$Parent
                        </SET>
                    </FIELD>

                    <COLLECTION NAME="LedgerNatureTestCollection">
                        <TYPE>Ledger</TYPE>
                        <FETCH>
                            Name,
                            Parent,
                            GUID
                        </FETCH>
                    </COLLECTION>

                </TDLMESSAGE>

            </TDL>

        </DESC>

    </BODY>

</ENVELOPE>
`;

    const result =
        await sendToTally(xml);

    fs.writeFileSync(
        "./ledger-nature-test.xml",
        String(result),
        "utf8"
    );

    console.log(
        "LEDGER NATURE TEST SAVED"
    );

    return parser.parse(result);
}


// =========================
// PROFIT & LOSS
// =========================

async function getProfitAndLoss(company) {

    throw new Error(
        "Not implemented"
    );

}


// =========================
// BALANCE SHEET
// =========================

async function getBalanceSheet(company) {

    throw new Error(
        "Not implemented"
    );

}


// =========================
// LEDGER REPORT
// =========================

async function getLedgerReport(
    company,
    ledgerName
) {

    throw new Error(
        "Not implemented"
    );

}


// =========================
// STOCK SUMMARY
// =========================

async function getStockSummary(company) {

    throw new Error(
        "Not implemented"
    );

}


// =========================
// EXPORTS
// =========================

module.exports = {

    getTrialBalance,

    getProfitAndLoss,

    getBalanceSheet,

    getLedgerReport,

    testLedgerNature,

    getStockSummary

};