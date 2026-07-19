
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

// =========================
// TRIAL BALANCE
// =========================

async function getTrialBalance({
    company,
    asOnDate
}) {

    // Select Company
    await selectCompany(company);

    // Build XML
  const xml = `
<ENVELOPE>

    <HEADER>

        <VERSION>1</VERSION>

        <TALLYREQUEST>Export</TALLYREQUEST>

        <TYPE>Data</TYPE>

        <ID>Trial Balance</ID>

    </HEADER>

    <BODY>

        <DESC>

            <STATICVARIABLES>

    <SVCURRENTCOMPANY>${company}</SVCURRENTCOMPANY>

    <SVTODATE>${asOnDate}</SVTODATE>

    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>

</STATICVARIABLES>

        </DESC>

    </BODY>

</ENVELOPE>
`;
    // Send to Tally
    const result = await sendToTally(xml);

    fs.writeFileSync(
    "trial-balance.xml",
    result
);

    // Parse XML
    const json = parser.parse(result);
   

fs.writeFileSync(
    "trial-balance.json",
    JSON.stringify(json, null, 2)
);

    const names = json.ENVELOPE?.DSPACCNAME || [];
const infos = json.ENVELOPE?.DSPACCINFO || [];

const trialBalance = names.map((item, index) => ({

    ledger: item.DSPDISPNAME || "",

    debit: Math.abs(
        Number(
            infos[index]?.DSPCLDRAMT?.DSPCLDRAMTA || 0
        )
    ),

    credit: Math.abs(
        Number(
            infos[index]?.DSPCLCRAMT?.DSPCLCRAMTA || 0
        )
    )

}));

    // Return JSON
   // return trialBalance;
return json;
}

// =========================
// PROFIT & LOSS
// =========================

async function getProfitAndLoss(company) {

    throw new Error("Not implemented");

}

// =========================
// BALANCE SHEET
// =========================

async function getBalanceSheet(company) {

    throw new Error("Not implemented");

}

// =========================
// LEDGER REPORT
// =========================

async function getLedgerReport(company, ledgerName) {

    throw new Error("Not implemented");

}

// =========================
// STOCK SUMMARY
// =========================

async function getStockSummary(company) {

    throw new Error("Not implemented");

}

module.exports = {

    getTrialBalance,

    getProfitAndLoss,

    getBalanceSheet,

    getLedgerReport,

    getStockSummary

};