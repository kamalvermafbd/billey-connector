const {
    sendToTally,
    selectCompany
} = require("./tallyService");

const {
    buildLedgerRequest
} = require("./ledgerRequest");

const {
    parseLedgerResponse
} = require("./ledgerParser");

const {
    getLookups
} = require("./lookupCache");


function resolveLedgerNature(
    parentName,
    groupLookup
) {

    let current =
        String(parentName || "")
            .trim();

    const visited = new Set();

    while (
        current &&
        !visited.has(current)
    ) {

        visited.add(current);

        const group =
            groupLookup.get(
                current.toUpperCase()
            );

        if (!group) {
            return "";
        }

        const reserved =
            String(
                group.reservedName || ""
            ).trim();

        if (reserved === "Current Assets") {
            return "Assets";
        }

        if (reserved === "Fixed Assets") {
            return "Assets";
        }

        if (reserved === "Current Liabilities") {
            return "Liabilities";
        }

        if (reserved === "Loans (Liability)") {
            return "Liabilities";
        }

        if (reserved === "Capital Account") {
            return "Capital";
        }

        current =
            String(group.parent || "")
                .trim();

        if (
            !current ||
            /^Primary$/i.test(current)
        ) {
            return "";
        }
    }

    return "";
}

async function importLedgers({
    company,
    booksBeginningFrom,
    lastLedgerAlterId = null,
    masterIds = []
}) {

    console.log(
        "Ledger booksBeginningFrom:",
        booksBeginningFrom
    );

    await selectCompany(company);


    const requestXml =
        buildLedgerRequest({
            company,
            booksBeginningFrom,
            lastLedgerAlterId,
            masterIds
        });


    const responseXml =
        await sendToTally(requestXml);


    const ledgers =
        parseLedgerResponse(
            responseXml
        );


    const lookups =
        getLookups(
            company
        ) || {};


    const groupLookup =
        lookups.groupLookup ||
        new Map();


    for (const ledger of ledgers) {

        const parent =
            groupLookup.get(
                String(
                    ledger.parent || ""
                )
                .trim()
                .toUpperCase()
            );


        if (!parent) {
            continue;
        }


        ledger.parentGroupGuid =
            parent.guid;

        ledger.parentGroupMasterId =
            parent.masterId;

        ledger.parentGroupAlterId =
            parent.alterId;

        ledger.parentGroupReservedName =
            parent.reservedName || "";

        ledger.nature =
            resolveLedgerNature(
                ledger.parent,
                groupLookup
            );

    }


    return ledgers;
}


module.exports = {
    importLedgers
};