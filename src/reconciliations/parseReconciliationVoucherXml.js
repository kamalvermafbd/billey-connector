"use strict";

const { XMLParser, XMLValidator } = require("fast-xml-parser");
const { parseVoucherHeader } = require("../tally/voucherHeader");
const { parseVoucherLedgers } = require("../tally/voucherLedgers");
const {
    buildReconciliationVoucherOccurrenceRequest
} = require("./reconciliationVoucherOccurrenceRequest");
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
        /^([+-]?)(?:(\d+)(?:\.(\d{1,6}))?|\.(\d{1,6}))$/
            .exec(amountText);

    if (!match) {
        fail("RECONCILE_RAW_AMOUNT_INVALID");
    }

    const whole = match[2] || "0";

    const fraction =
        (match[3] || match[4] || "").padEnd(6, "0");

    const units =
        BigInt(whole) * 1000000n + BigInt(fraction);

    if (units > BigInt(Number.MAX_SAFE_INTEGER)) {
        fail("RECONCILE_RAW_AMOUNT_OUT_OF_RANGE");
    }

    const magnitude =
        `${units / 1000000n}.${String(units % 1000000n).padStart(6, "0")}`;

    return direction === "Yes"
        ? { debit: magnitude, credit: "0.000000" }
        : { debit: "0.000000", credit: magnitude };
}

function guid(value) {
    const result = text(value);

    if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,127}$/.test(result)) {
        fail("RECONCILE_GUID_INVALID");
    }

    return result;
}

function rememberGuid(index, value, duplicateCode, collisionCode) {
    const folded = value.toLowerCase();

    if (index.has(folded)) {
        fail(
            index.get(folded) === value
                ? duplicateCode
                : collisionCode
        );
    }

    index.set(folded, value);
}

function requireExactGuid(actual, expected, mismatchCode, conflictCode) {
    const actualGuid = guid(actual);
    const expectedGuid = guid(expected);

    if (actualGuid !== expectedGuid) {
        fail(
            actualGuid.toLowerCase() === expectedGuid.toLowerCase()
                ? conflictCode
                : mismatchCode
        );
    }
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
    const ledgerCaseIndex = new Map();

    for (const ledger of ledgers) {
        const name = text(ledger.NAME);
        const ledgerGuid = guid(ledger.GUID);
        const key = name.toUpperCase();

        if (ledgerLookup.has(key)) {
            fail("RECONCILE_LEDGER_LOOKUP_AMBIGUOUS");
        }

        rememberGuid(
            ledgerCaseIndex,
            ledgerGuid,
            "RECONCILE_LEDGER_GUID_DUPLICATE",
            "RECONCILE_LEDGER_GUID_CASE_COLLISION"
        );

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
    const requestedCaseIndex = new Map();

    for (const value of requested) {
        rememberGuid(
            requestedCaseIndex,
            value,
            "RECONCILE_REQUEST_GUID_DUPLICATE",
            "RECONCILE_REQUEST_GUID_CASE_COLLISION"
        );
    }

    const expected = new Set(requested);
    const rawVouchers = collectionRows(responseXml, "VOUCHER");
    const seen = new Set();
    const responseCaseIndex = new Map();

    const vouchers = rawVouchers.map(rawVoucher => {
        const voucherGuid = guid(rawVoucher.GUID);

        rememberGuid(
            responseCaseIndex,
            voucherGuid,
            "RECONCILE_RESPONSE_GUID_DUPLICATE",
            "RECONCILE_RESPONSE_GUID_CASE_COLLISION"
        );

        if (!expected.has(voucherGuid)) {
            if (requestedCaseIndex.has(voucherGuid.toLowerCase())) {
                fail("RECONCILE_RESPONSE_GUID_CASE_CONFLICT");
            }

            fail("RECONCILE_UNEXPECTED_VOUCHER_GUID");
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
                ledger.ledgerName !== expectedLedger.name
            ) {
                fail("RECONCILE_LEDGER_OCCURRENCE_IDENTITY_MISMATCH");
            }

            requireExactGuid(
                ledger.ledgerGuid,
                expectedLedger.guid,
                "RECONCILE_LEDGER_OCCURRENCE_IDENTITY_MISMATCH",
                "RECONCILE_LEDGER_OCCURRENCE_GUID_CASE_CONFLICT"
            );

            if (
                Object.prototype.hasOwnProperty.call(
                    rawRow,
                    "LEDGERGUID"
                )
            ) {
                requireExactGuid(
                    rawRow.LEDGERGUID,
                    expectedLedger.guid,
                    "RECONCILE_SOURCE_LEDGER_GUID_MISMATCH",
                    "RECONCILE_SOURCE_LEDGER_GUID_CASE_CONFLICT"
                );
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
            ledgerOccurrenceSource: hasAll
                ? "ALLLEDGERENTRIES.LIST"
                : "LEDGERENTRIES.LIST",
            ledgers: exactLedgers
        };
    });

    
    const presentGuids = requested.filter(
        value => seen.has(value)
    );

    const missingGuids = requested.filter(
        value => !seen.has(value)
    );

    const validatedVouchers =
        validateRawTallyVoucherLedgerAmounts(vouchers);

    const entries = normalizeTallyVoucherEntries(
        validatedVouchers,
        { companyCode, tallyOwner }
    );

    // Classification only. A missing GUID is NOT
    // verified absent without independent Tally evidence.
    return {
        vouchers: validatedVouchers,
        entries,
        presentGuids,
        missingGuids,
        snapshotCoverage: {
            // Presence does not prove complete ledger occurrence coverage.
            tallyCompleteVoucherGuids: [],
            tallyUnverifiedMissingGuids: missingGuids
        }
    };
}

function verifyReconciliationVoucherOccurrences({
    beforeXml,
    afterXml,
    request,
    snapshot
}) {
    function occurrenceFail(reason) {
        fail(`RECONCILE_OCCURRENCE_${reason}`);
    }

    if (!request || !record(snapshot)) {
        occurrenceFail("CONTEXT_INVALID");
    }

    // Reuse strict request validation without sending to Tally.
    buildReconciliationVoucherOccurrenceRequest({
        company: request.company,
        voucherGuids: request.voucherGuids,
        fromDate: request.fromDate,
        toDate: request.toDate
    });

    const requested = [...request.voucherGuids];
    const expected = new Set(requested);

    function exactMembership(values, reason) {
        if (!Array.isArray(values)) {
            occurrenceFail(reason);
        }

        const index = new Map();

        for (const value of values) {
            const actual = guid(value);

            if (actual !== value) {
                occurrenceFail(reason);
            }

            rememberGuid(
                index,
                actual,
                "RECONCILE_OCCURRENCE_GUID_DUPLICATE",
                "RECONCILE_OCCURRENCE_GUID_CASE_COLLISION"
            );
        }

        if (
            values.length !== requested.length ||
            values.some(value => !expected.has(value))
        ) {
            occurrenceFail(reason);
        }
    }

    function requiredScalar(value, reason) {
        if (
            typeof value !== "string" ||
            !value ||
            value !== value.trim()
        ) {
            occurrenceFail(reason);
        }

        return value;
    }

    function version(value) {
        const result = requiredScalar(
            value,
            "VERSION_INVALID"
        );

        if (!/^(0|[1-9]\d*)$/.test(result)) {
            occurrenceFail("VERSION_INVALID");
        }

        return result;
    }

    function voucherDate(value, voucherGuid) {
        const result = requiredScalar(
            value,
            "DATE_INVALID"
        );

        buildReconciliationVoucherOccurrenceRequest({
            company: request.company,
            voucherGuids: [voucherGuid],
            fromDate: result,
            toDate: result
        });

        if (
            result < request.fromDate ||
            result > request.toDate
        ) {
            occurrenceFail("DATE_OUT_OF_SCOPE");
        }

        return result;
    }

    function count(value) {
        if (
            typeof value !== "string" ||
            value.length > 16 ||
            !/^(0|[1-9]\d*)$/.test(value) ||
            BigInt(value) > BigInt(Number.MAX_SAFE_INTEGER)
        ) {
            occurrenceFail("COUNT_INVALID");
        }

        const result = Number(value);

        // A present voucher with zero entries is not absent.
        // Current parser requires nonempty ledger occurrences.
        if (result === 0) {
            occurrenceFail("ZERO_COUNT_UNSUPPORTED");
        }

        return result;
    }

    function independentRows(xml) {
        if (
            typeof xml !== "string" ||
            xml.length > 8 * 1024 * 1024
        ) {
            occurrenceFail("RESPONSE_INVALID");
        }

        // Candidate Tally response shape.
        const rows = collectionRows(xml, "VOUCHER");

        exactMembership(
            rows.map(row => row.GUID),
            "RESPONSE_MEMBERSHIP_INVALID"
        );

        return new Map(rows.map(row => {
            if (
                !Object.prototype.hasOwnProperty.call(
                    row,
                    "BILLEYLEDGEROCCURRENCECOUNT"
                )
            ) {
                occurrenceFail("COUNT_MISSING");
            }

            return [
                row.GUID,
                {
                    masterId: version(row.MASTERID),
                    alterId: version(row.ALTERID),
                    date: voucherDate(row.DATE, row.GUID),
                    count: count(
                        row.BILLEYLEDGEROCCURRENCECOUNT
                    )
                }
            ];
        }));
    }

    if (
        !Array.isArray(snapshot.vouchers) ||
        !Array.isArray(snapshot.entries) ||
        !Array.isArray(snapshot.missingGuids) ||
        snapshot.missingGuids.length !== 0
    ) {
        occurrenceFail("SNAPSHOT_INCOMPLETE");
    }

    exactMembership(
        snapshot.presentGuids,
        "SNAPSHOT_MEMBERSHIP_INVALID"
    );

    exactMembership(
        snapshot.vouchers.map(
            voucher => voucher?.header?.guid
        ),
        "SNAPSHOT_MEMBERSHIP_INVALID"
    );

    const normalizedCounts = new Map();

    for (const entry of snapshot.entries) {
        if (
            !record(entry) ||
            !expected.has(entry.voucherGuid)
        ) {
            occurrenceFail("NORMALIZED_MEMBERSHIP_INVALID");
        }

        normalizedCounts.set(
            entry.voucherGuid,
            (normalizedCounts.get(entry.voucherGuid) || 0) + 1
        );
    }

    const before = independentRows(beforeXml);
    const after = independentRows(afterXml);

    const vouchers = new Map(
        snapshot.vouchers.map(voucher => [
            voucher.header.guid,
            voucher
        ])
    );

    const counts = requested.map(voucherGuid => {
        const voucher = vouchers.get(voucherGuid);

        if (
            voucher.ledgerOccurrenceSource !==
                "ALLLEDGERENTRIES.LIST" ||
            !Array.isArray(voucher.ledgers) ||
            voucher.ledgers.length === 0
        ) {
            occurrenceFail("SEMANTICS_UNSUPPORTED");
        }

        const header = voucher.header;

        const masterId = version(header.masterid);
        const alterId = version(header.alterid);

        const date = voucherDate(
            header.voucherDate,
            voucherGuid
        );

        const parsedCount = voucher.ledgers.length;

        const normalizedCount =
            normalizedCounts.get(voucherGuid) || 0;

        for (const evidence of [
            before.get(voucherGuid),
            after.get(voucherGuid)
        ]) {
            if (
                evidence.masterId !== masterId ||
                evidence.alterId !== alterId ||
                evidence.date !== date
            ) {
                occurrenceFail("VERSION_MISMATCH");
            }

            if (
                evidence.count !== parsedCount ||
                normalizedCount !== parsedCount
            ) {
                occurrenceFail("COUNT_MISMATCH");
            }
        }

        return {
            voucherGuid,
            parsedCount,
            normalizedCount,
            independentBeforeCount:
                before.get(voucherGuid).count,
            independentAfterCount:
                after.get(voucherGuid).count
        };
    });

    return {
        schemaVersion: 1,
        status: "COUNT_AGREEMENT_UNVERIFIED",
        semanticProfile: "CANDIDATE_ALLLEDGERENTRIES_V1",
        counts,
        runtimeSemanticsVerified: false,
        atomicSnapshotVerified: false,
        settlementEligible: false
    };
}


module.exports = {
    parseReconciliationEnvelope,
    collectionRows,
    buildReconciliationLedgerLookups,
    parseReconciliationVoucherXml,
    verifyReconciliationVoucherOccurrences
};