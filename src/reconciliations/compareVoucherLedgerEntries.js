"use strict";

// Inputs are rupee amounts; normalized amounts are integer paise.
// Decimal strings must contain at most two fractional digits. Never round.
function normalizeAmount(value) {
    const isNumber = typeof value === "number";

    if (
        (!isNumber && typeof value !== "string") ||
        (isNumber && !Number.isFinite(value))
    ) {
        throw new Error("RECONCILE_INVALID_AMOUNT");
    }

    const text = String(value).trim();

    if (text.startsWith("-") || Object.is(value, -0)) {
        throw new Error("RECONCILE_NEGATIVE_DEBIT_CREDIT");
    }

    const match =
        /^\+?(?:(\d+)(?:\.(\d{1,2}))?|\.(\d{1,2}))$/.exec(text);

    if (!match) {
        throw new Error("RECONCILE_INVALID_AMOUNT");
    }

    if (isNumber && value >= 2 ** 46) {
        throw new Error("RECONCILE_AMOUNT_OUT_OF_RANGE");
    }

    const whole = match[1] || "0";
    const fraction = (match[2] || match[3] || "").padEnd(2, "0");

    const paise = BigInt(whole) * 100n + BigInt(fraction);

    if (paise > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error("RECONCILE_AMOUNT_OUT_OF_RANGE");
    }

    return Number(paise);
}

function normalizeEntry(entry) {
    const companyCode = String(
        entry?.companyCode || entry?.company_code || ""
    ).trim();

    const tallyOwner = String(
        entry?.tallyOwner || entry?.tally_owner || ""
    ).trim();

    const voucherGuid = String(
        entry?.voucherGuid || entry?.voucher_guid || ""
    ).trim().toLowerCase();

    const ledgerGuid = String(
        entry?.ledgerGuid || entry?.ledger_guid || ""
    ).trim().toLowerCase();

    if (
        !companyCode ||
        !["USER", "CA"].includes(tallyOwner) ||
        !voucherGuid ||
        !ledgerGuid
    ) {
        throw new Error("RECONCILE_ENTRY_IDENTITY_MISSING");
    }

    const debit = normalizeAmount(entry.debit);
    const credit = normalizeAmount(entry.credit);

    if (debit < 0 || credit < 0) {
        throw new Error("RECONCILE_NEGATIVE_DEBIT_CREDIT");
    }

  
    const result = {
        companyCode,
        tallyOwner,
        voucherGuid,
        ledgerGuid,
        debit,
        credit
    };

    if (entry.id !== undefined && entry.id !== null) {
        if (
            !Number.isSafeInteger(entry.id) ||
            entry.id <= 0
        ) {
            throw new Error("RECONCILE_ENTRY_ID_INVALID");
        }

        result.id = entry.id;
    }

    return result;

}

function groupEntries(entries) {
    const groups = new Map();

    for (const raw of entries) {
        const entry = normalizeEntry(raw);

       const key = JSON.stringify([
    entry.companyCode,
    entry.tallyOwner,
    entry.voucherGuid,
    entry.ledgerGuid
]);

        if (!groups.has(key)) {
            groups.set(key, []);
        }

        groups.get(key).push(entry);
    }

    return groups;
}

function entrySignature(entry) {
    return `${entry.debit}:${entry.credit}`;
}

function compareVoucherLedgerEntries(tallyEntries, sqlEntries) {
    if (!Array.isArray(tallyEntries) ||
        !Array.isArray(sqlEntries)) {
        throw new TypeError("RECONCILE_ENTRIES_INVALID");
    }

    const tallyGroups = groupEntries(tallyEntries);
    const sqlGroups = groupEntries(sqlEntries);

    const keys = new Set([
        ...tallyGroups.keys(),
        ...sqlGroups.keys()
    ]);

    const differences = [];

    for (const key of keys) {
        const tally = tallyGroups.get(key) || [];
        const sql = sqlGroups.get(key) || [];

        const tallyCounts = new Map();
        const sqlCounts = new Map();

        for (const entry of tally) {
            const signature = entrySignature(entry);

            tallyCounts.set(
                signature,
                (tallyCounts.get(signature) || 0) + 1
            );
        }

        for (const entry of sql) {
            const signature = entrySignature(entry);

            sqlCounts.set(
                signature,
                (sqlCounts.get(signature) || 0) + 1
            );
        }

        const signatures = new Set([
            ...tallyCounts.keys(),
            ...sqlCounts.keys()
        ]);

        const tallyOnly = [];
        const sqlOnly = [];

        // Diagnostic only: never authorize a database UPDATE here.
        const updateCandidate =
            tally.length === 1 &&
            sql.length === 1 &&
            Number.isSafeInteger(sql[0].id) &&
            (
                tally[0].debit !== sql[0].debit ||
                tally[0].credit !== sql[0].credit
            )
                ? {
                    sqlRowId: sql[0].id,
                    currentDebit: sql[0].debit,
                    currentCredit: sql[0].credit,
                    tallyDebit: tally[0].debit,
                    tallyCredit: tally[0].credit
                }
                : null;

        for (const signature of signatures) {
            const tallyCount = tallyCounts.get(signature) || 0;
            const sqlCount = sqlCounts.get(signature) || 0;

            const [debit, credit] =
                signature.split(":").map(Number);

            if (tallyCount > sqlCount) {
                tallyOnly.push({
                    debit,
                    credit,
                    count: tallyCount - sqlCount
                });
            }

            
if (sqlCount > tallyCount) {
    const matchingSqlEntries = sql.filter(
        entry => entrySignature(entry) === signature
    );

    const unmatchedCount = sqlCount - tallyCount;

    sqlOnly.push({
        debit,
        credit,
        count: unmatchedCount,
        
candidateSqlRowIds:
    tallyCount === 0 &&
    matchingSqlEntries.length === 1 &&
    Number.isSafeInteger(matchingSqlEntries[0].id)
        ? [matchingSqlEntries[0].id]
        : []

    });
}

        }

      if (tallyOnly.length || sqlOnly.length) {
    const [
        companyCode,
        tallyOwner,
        voucherGuid,
        ledgerGuid
    ] = JSON.parse(key);

    differences.push({
        companyCode,
        tallyOwner,
        voucherGuid,
        ledgerGuid,
        tallyOnly,
        sqlOnly,
        updateCandidate
    });
}
    }

    return differences;
}

module.exports = {
    compareVoucherLedgerEntries
};