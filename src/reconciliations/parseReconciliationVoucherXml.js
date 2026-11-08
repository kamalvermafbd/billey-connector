"use strict";

const { XMLParser, XMLValidator } = require("fast-xml-parser");
const { parseVoucherHeader } = require("../tally/voucherHeader");
const { parseVoucherLedgers } = require("../tally/voucherLedgers");

const {
    validateRawTallyVoucherLedgerAmounts
} = require("./validateRawTallyVoucherLedgerAmounts");

const {
    normalizeTallyVoucherEntries
} = require("./normalizeTallyVoucherEntries");

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true
});

function fail(code) {
    throw new Error(code);
}

function record(value) {
    return value !== null &&
        typeof value === "object" &&
        !Array.isArray(value);
}

function text(value) {
    if (typeof value !== "string" || !value.trim()) {
        fail("RECONCILE_TEXT_REQUIRED");
    }

    return value.trim();
}

// Reconciliation debit/credit only.
// Never derive these values from the shared parser's numeric amount.
function exactReconciliationDebitCredit(rawRow) {
    function rawText(value, field) {
        if (record(value)) {
            const keys = Object.keys(value);

            if (
                keys.length !== 1 ||
                !["#text", "TEXT"].includes(keys[0])
            ) {
                fail(`RECONCILE_RAW_${field}_INVALID`);
            }

            value = value[keys[0]];
        }

        if (typeof value !== "string" || !value.trim()) {
            fail(`RECONCILE_RAW_${field}_TEXT_REQUIRED`);
        }

        return value.trim();
    }

    const amountText = rawText(rawRow.AMOUNT, "AMOUNT");

    const direction = rawText(
        rawRow.ISDEEMEDPOSITIVE,
        "DIRECTION"
    );

    if (direction !== "Yes" && direction !== "No") {
        fail("RECONCILE_RAW_DIRECTION_INVALID");
    }

    const match =
        /^([+-]?)(?:(\d+)(?:\.(\d{1,2}))?|\.(\d{1,2}))$/
            .exec(amountText);

    if (!match) {
        fail("RECONCILE_RAW_AMOUNT_INVALID");
    }

    const whole = match[2] || "0";

    const fraction =
        (match[3] || match[4] || "").padEnd(2, "0");

    const paise =
        BigInt(whole) * 100n + BigInt(fraction);

    if (paise > BigInt(Number.MAX_SAFE_INTEGER)) {
        fail("RECONCILE_RAW_AMOUNT_OUT_OF_RANGE");
    }

    const magnitude =
        `${paise / 100n}.${String(paise % 100n).padStart(2, "0")}`;

    return direction === "Yes"
        ? { debit: magnitude, credit: "0.00" }
        : { debit: "0.00", credit: magnitude };
}
function guid(value) {
    const result = text(value);

    if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,127}$/.test(result)) {
        fail("RECONCILE_GUID_INVALID");
    }

    return result.toLowerCase();
}

function rejectErrors(value) {
    if (!value || typeof value !== "object") return;

    for (const [key, child] of Object.entries(value)) {
        if (/^(LINEERROR|ERROR|ERRORS|EXCEPTION|EXCEPTIONS)$/i.test(key)) {
            fail("RECONCILE_TALLY_ERROR");
        }

        rejectErrors(child);
    }
}

function parseReconciliationEnvelope(xml) {
    if (
        typeof xml !== "string" ||
        !xml.trim() ||
        /<!DOCTYPE|<!ENTITY/i.test(xml) ||
        XMLValidator.validate(xml) !== true
    ) {
        fail("RECONCILE_XML_INVALID");
    }

    const document = parser.parse(xml);

    const rootKeys = Object.keys(document)
        .filter(key => key !== "?xml");

    if (
        rootKeys.length !== 1 ||
        rootKeys[0] !== "ENVELOPE" ||
        !record(document.ENVELOPE)
    ) {
        fail("RECONCILE_ENVELOPE_INVALID");
    }

    const envelope = document.ENVELOPE;

    rejectErrors(envelope);

    if (
        !record(envelope.HEADER) ||
        envelope.HEADER.STATUS !== "1" ||
        !record(envelope.BODY) ||
        !record(envelope.BODY.DATA)
    ) {
        fail("RECONCILE_ENVELOPE_INCOMPLETE");
    }

    return envelope.BODY.DATA;
}

function collectionRows(xml, element) {
    const data = parseReconciliationEnvelope(xml);

    if (
        Object.keys(data).length !== 1 ||
        !record(data.COLLECTION)
    ) {
        fail("RECONCILE_COLLECTION_INVALID");
    }

    const collection = data.COLLECTION;

    const elementKeys = Object.keys(collection)
        .filter(key => !key.startsWith("@_"));

    if (elementKeys.some(key => key !== element)) {
        fail("RECONCILE_COLLECTION_AMBIGUOUS");
    }

    if (!Object.prototype.hasOwnProperty.call(collection, element)) {
        return [];
    }

    const rows = Array.isArray(collection[element])
        ? collection[element]
        : [collection[element]];

    if (!rows.every(record)) {
        fail("RECONCILE_COLLECTION_ROWS_INVALID");
    }

    return rows;
}

function buildReconciliationLedgerLookups(ledgers) {
    if (!Array.isArray(ledgers) || ledgers.length === 0) {
        fail("RECONCILE_LEDGER_SNAPSHOT_REQUIRED");
    }

    const ledgerLookup = new Map();
    const seenGuids = new Set();

    for (const ledger of ledgers) {
        const name = text(ledger.NAME);
        const ledgerGuid = guid(ledger.GUID);
        const key = name.toUpperCase();

        if (ledgerLookup.has(key) || seenGuids.has(ledgerGuid)) {
            fail("RECONCILE_LEDGER_LOOKUP_AMBIGUOUS");
        }

        seenGuids.add(ledgerGuid);

        ledgerLookup.set(key, {
            name,
            guid: ledgerGuid,
            masterId: text(ledger.MASTERID),
            alterId: text(ledger.ALTERID)
        });
    }

    return {
        ledgerLookup,
        groupLookup: new Map()
    };
}

function parseReconciliationVoucherXml({
    responseXml,
    requestedGuids,
    lookups,
    companyCode,
    tallyOwner
}) {
    if (
        !Array.isArray(requestedGuids) ||
        requestedGuids.length === 0 ||
        !(lookups?.ledgerLookup instanceof Map)
    ) {
        fail("RECONCILE_PARSE_CONTEXT_INVALID");
    }

    const requested = requestedGuids.map(guid);
    const expected = new Set(requested);

    if (expected.size !== requested.length) {
        fail("RECONCILE_REQUEST_GUID_DUPLICATE");
    }

    const rawVouchers = collectionRows(responseXml, "VOUCHER");
    const seen = new Set();

    const vouchers = rawVouchers.map(rawVoucher => {
        const voucherGuid = guid(rawVoucher.GUID);

        if (!expected.has(voucherGuid)) {
            fail("RECONCILE_UNEXPECTED_VOUCHER_GUID");
        }

        if (seen.has(voucherGuid)) {
            fail("RECONCILE_RESPONSE_GUID_DUPLICATE");
        }

        seen.add(voucherGuid);

        const hasAll = Object.prototype.hasOwnProperty.call(
            rawVoucher,
            "ALLLEDGERENTRIES.LIST"
        );

        const hasLegacy = Object.prototype.hasOwnProperty.call(
            rawVoucher,
            "LEDGERENTRIES.LIST"
        );

        if (hasAll === hasLegacy) {
            fail("RECONCILE_LEDGER_LIST_AMBIGUOUS");
        }

        const source = rawVoucher[
            hasAll
                ? "ALLLEDGERENTRIES.LIST"
                : "LEDGERENTRIES.LIST"
        ];

        const rawRows = Array.isArray(source)
            ? source
            : [source];

        if (
            rawRows.length === 0 ||
            !rawRows.every(record)
        ) {
            fail("RECONCILE_RAW_LEDGER_ROWS_INVALID");
        }

        const ledgers = parseVoucherLedgers(
            rawVoucher,
            lookups
        );

        if (ledgers.length !== rawRows.length) {
            fail("RECONCILE_LEDGER_OCCURRENCE_COUNT_MISMATCH");
        }

        const exactLedgers = ledgers.map((ledger, index) => {
            const rawRow = rawRows[index];
            const name = text(rawRow.LEDGERNAME);

            const expectedLedger = lookups.ledgerLookup.get(
                name.toUpperCase()
            );

            if (!expectedLedger) {
                fail("RECONCILE_LEDGER_LOOKUP_MISSING");
            }

            if (
                ledger.raw !== rawRow ||
                ledger.ledgerName !== expectedLedger.name ||
                guid(ledger.ledgerGuid) !== guid(expectedLedger.guid)
            ) {
                fail("RECONCILE_LEDGER_OCCURRENCE_IDENTITY_MISMATCH");
            }

            if (
                Object.prototype.hasOwnProperty.call(
                    rawRow,
                    "LEDGERGUID"
                ) &&
                guid(rawRow.LEDGERGUID) !== guid(expectedLedger.guid)
            ) {
                fail("RECONCILE_SOURCE_LEDGER_GUID_MISMATCH");
            }

                      if (
                Object.prototype.hasOwnProperty.call(
                    rawRow,
                    "LEDGERMASTERID"
                ) &&
                text(rawRow.LEDGERMASTERID) !== expectedLedger.masterId
            ) {
                fail("RECONCILE_SOURCE_LEDGER_MASTERID_MISMATCH");
            }

            return {
                ...ledger,
                ...exactReconciliationDebitCredit(rawRow)
            };
        });

            return {
            header: {
                ...parseVoucherHeader(rawVoucher),
                guid: voucherGuid
            },
            ledgers: exactLedgers
        };
    });

    if (
        seen.size !== expected.size ||
        requested.some(value => !seen.has(value))
    ) {
        fail("RECONCILE_MISSING_VOUCHER_GUID");
    }

    const validatedVouchers =
        validateRawTallyVoucherLedgerAmounts(vouchers);

    const entries = normalizeTallyVoucherEntries(
        validatedVouchers,
        { companyCode, tallyOwner }
    );

    return {
        vouchers: validatedVouchers,
        entries
    };
}

module.exports = {
    parseReconciliationEnvelope,
    collectionRows,
    buildReconciliationLedgerLookups,
    parseReconciliationVoucherXml
};