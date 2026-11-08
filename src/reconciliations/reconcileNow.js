"use strict";

const {
    buildLedgerBulkGuidRequest
} = require("../tally/ledgerBulkGuidRequest");

const {
    sendToTally,
    selectCompany
} = require("../tally/tallyService");

const { XMLParser } = require("fast-xml-parser");

const reconcileXmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    parseTagValue: true,
    trimValues: true
});

// ==============================================
// RECONCILE NOW — STRICT LEDGER OPENING VALIDATION
// ==============================================

function validateLedgerOpeningBalance(ledger, expectedGuid) {
    const guid = String(expectedGuid || "").trim();

    if (!guid) {
        throw new Error("RECONCILE_LEDGER_GUID_REQUIRED");
    }

    if (!ledger || typeof ledger !== "object") {
        throw new Error("RECONCILE_LEDGER_RESPONSE_INVALID");
    }

    const actualGuid = String(
        ledger.GUID?.["#text"] ?? ledger.GUID ?? ""
    ).trim();

    if (actualGuid !== guid) {
        throw new Error("RECONCILE_LEDGER_GUID_MISMATCH");
    }

    if (!Object.prototype.hasOwnProperty.call(
        ledger,
        "OPENINGBALANCE"
    )) {
        throw new Error("RECONCILE_OPENING_BALANCE_MISSING");
    }

    const raw = ledger.OPENINGBALANCE?.["#text"]
        ?? ledger.OPENINGBALANCE;

    const value = String(raw ?? "").trim();

    if (
        !value ||
        !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)
    ) {
        throw new Error("RECONCILE_OPENING_BALANCE_INVALID");
    }

    const signedAmount = Number(value);

    if (!Number.isFinite(signedAmount)) {
        throw new Error("RECONCILE_OPENING_BALANCE_NOT_FINITE");
    }

    return {
        guid,
        openingBalance: Math.abs(signedAmount),
        openingBalanceType:
            signedAmount < 0
                ? "DR"
                : signedAmount > 0
                    ? "CR"
                    : ""
    };
}

async function fetchLedgerOpeningBalance({
    company,
    ledgerGuid,
    booksBeginningFrom
}) {
    const guid = String(ledgerGuid || "").trim();

    if (!String(company || "").trim()) {
        throw new Error("RECONCILE_COMPANY_REQUIRED");
    }

    if (!guid) {
        throw new Error("RECONCILE_LEDGER_GUID_REQUIRED");
    }

    if (
        typeof booksBeginningFrom !== "string" ||
        !/^\d{8}$/.test(booksBeginningFrom)
    ) {
        throw new Error("RECONCILE_BOOKS_BEGINNING_DATE_INVALID");
    }

    const xml = buildLedgerBulkGuidRequest({
        company,
        ledgerGuids: [guid],
        booksBeginningFrom
    });

    await selectCompany(company);

    const response = await sendToTally(xml);

    if (typeof response !== "string" || !response.trim()) {
        throw new Error("RECONCILE_TALLY_RESPONSE_EMPTY");
    }

    const parsed = reconcileXmlParser.parse(response);

    const collection =
        parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION;

    if (!collection || typeof collection !== "object") {
        throw new Error("RECONCILE_LEDGER_COLLECTION_MISSING");
    }

    const rawLedgers = collection.LEDGER;

    const ledgers = Array.isArray(rawLedgers)
        ? rawLedgers
        : rawLedgers
            ? [rawLedgers]
            : [];

    if (ledgers.length !== 1) {
        throw new Error("RECONCILE_LEDGER_RESULT_COUNT_INVALID");
    }

    return validateLedgerOpeningBalance(
        ledgers[0],
        guid
    );
}
module.exports = {
    validateLedgerOpeningBalance,
    fetchLedgerOpeningBalance
};