
"use strict";

const { importCompany } = require("./companyImportService");
const { buildLedgerRequest } = require("./ledgerRequest");
const { sendToTally, selectCompany } = require("./tallyService");
const {
    importLedgerBulkByGuid
} = require("./ledgerImportServiceBulkGuid");
const { parseLedgerResponse } = require("./ledgerParser");

const COMPANY = "Guru Kirpa Trading";
const LEDGER = "Aggarwal Electrial & Hardware";

async function main() {
    console.log("========== LEDGER OPENING DIAGNOSTIC ==========");

    const companyInfo = await importCompany({
        company: COMPANY
    });

    console.log("Company dates:", {
        booksBeginningFrom: companyInfo.booksBeginningFrom,
        financialYearBeginning: companyInfo.financialYearBeginning,
        startingFrom: companyInfo.startingFrom
    });

    const requestXml = buildLedgerRequest({
        company: COMPANY,
        booksBeginningFrom: companyInfo.booksBeginningFrom,
        lastLedgerAlterId: null
    });

    await selectCompany(COMPANY);
    const responseXml = await sendToTally(requestXml);

    const ledgers = parseLedgerResponse(responseXml);

    const target = ledgers.find(
        row => String(row.name).trim().toLowerCase() ===
            LEDGER.toLowerCase()
    );

    if (!target) {
        throw new Error("Target ledger not found in Tally response");
    }

    console.log("========== RESULT ==========");
    console.log("Ledger:", target.name);
    console.log("Ledger ALTER ID:", target.alterId, target.raw?.ALTERID);
    console.log("Raw OPENINGBALANCE:", target.raw?.OPENINGBALANCE);
    console.log("Raw OPENINGBALANCEON:", target.raw?.OPENINGBALANCEON);
    console.log(
        "Raw ORIGINALOPENINGBALANCE:",
        target.raw?.ORIGINALOPENINGBALANCE
    );
    console.log("Parsed opening:", target.openingBalance);
    console.log("Amount:", target.openingBalanceAmount);
    console.log("Type:", target.openingBalanceType);
    console.log("========== BULK GUID RESULT ==========");

const bulkLedgers = await importLedgerBulkByGuid({
    company: COMPANY,
    ledgerGuids: [target.guid],
    groups: [],
    booksBeginningFrom: companyInfo.booksBeginningFrom
});

const bulkTarget = bulkLedgers.find(
    row => String(row.guid).trim() === String(target.guid).trim()
);

if (!bulkTarget) {
    throw new Error("Target ledger not found in bulk GUID response");
}

console.log("Bulk Ledger:", bulkTarget.name);
console.log("Bulk GUID:", bulkTarget.guid);
console.log("Bulk Raw OPENINGBALANCE:", bulkTarget.raw?.OPENINGBALANCE);
console.log("Bulk Raw OPENINGBALANCEON:", bulkTarget.raw?.OPENINGBALANCEON);
console.log("Bulk Parsed Opening:", bulkTarget.openingBalance);
console.log("Bulk Amount:", bulkTarget.openingBalanceAmount);
console.log("Bulk Type:", bulkTarget.openingBalanceType);
    console.log("============================");
}

main().catch(error => {
    console.error("DIAGNOSTIC FAILED:", error);
    process.exitCode = 1;
});
