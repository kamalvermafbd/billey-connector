
"use strict";

const MAX_PAISE = 9007199254740991n;

function fail(code) {
    throw new Error(code);
}

function compareText(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
}

function requireText(value) {
    if (typeof value !== "string" || !value.trim()) {
        fail("RECONCILE_PLAN_IDENTITY_INVALID");
    }

    return value.trim();
}

function normalizeAmount(value) {
    const isNumber = typeof value === "number";

    if (
        (!isNumber && typeof value !== "string") ||
        (
            isNumber &&
            (
                !Number.isFinite(value) ||
                Object.is(value, -0) ||
                value >= 2 ** 46
            )
        )
    ) {
        fail("RECONCILE_PLAN_AMOUNT_INVALID");
    }

    const text = String(value).trim();
    const match =
        /^\+?(?:(\d+)(?:\.(\d{1,2}))?|\.(\d{1,2}))$/.exec(text);

    if (!match) {
        fail("RECONCILE_PLAN_AMOUNT_INVALID");
    }

    const whole = match[1] || "0";
    const fraction = (match[2] || match[3] || "").padEnd(2, "0");
    const paise = BigInt(whole) * 100n + BigInt(fraction);

    if (paise > MAX_PAISE) {
        fail("RECONCILE_PLAN_AMOUNT_OUT_OF_RANGE");
    }

    return {
        rupees:
            `${paise / 100n}.${String(paise % 100n).padStart(2, "0")}`,
        paise: paise.toString()
    };
}

function normalizeEntry(entry, sql, seenIds) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        fail("RECONCILE_PLAN_ENTRY_INVALID");
    }

    const scope = {
        companyCode: requireText(entry.companyCode),
        tallyOwner: requireText(entry.tallyOwner),
        voucherGuid: requireText(entry.voucherGuid).toLowerCase(),
        ledgerGuid: requireText(entry.ledgerGuid).toLowerCase()
    };

    if (!["USER", "CA"].includes(scope.tallyOwner)) {
        fail("RECONCILE_PLAN_OWNER_INVALID");
    }

    if (sql) {
        if (!Number.isSafeInteger(entry.id) || entry.id <= 0) {
            fail("RECONCILE_PLAN_SQL_ID_INVALID");
        }

        if (seenIds.has(entry.id)) {
            fail("RECONCILE_PLAN_SQL_ID_DUPLICATE");
        }

        seenIds.add(entry.id);
    }

    const debit = normalizeAmount(entry.debit);
    const credit = normalizeAmount(entry.credit);

    const occurrence = {
        ...(sql ? { id: entry.id } : {}),
        debit: debit.rupees,
        credit: credit.rupees,
        debitPaise: debit.paise,
        creditPaise: credit.paise
    };

    return {
        scope,
        key: JSON.stringify([
            scope.companyCode,
            scope.tallyOwner,
            scope.voucherGuid,
            scope.ledgerGuid
        ]),
        occurrence
    };
}

function signature(entry) {
    return JSON.stringify([entry.debitPaise, entry.creditPaise]);
}

function countSignatures(entries) {
    const counts = new Map();

    for (const entry of entries) {
        const key = signature(entry);
        const existing = counts.get(key);

        if (existing) {
            existing.count++;
        } else {
            counts.set(key, {
                debit: entry.debit,
                credit: entry.credit,
                debitPaise: entry.debitPaise,
                creditPaise: entry.creditPaise,
                count: 1
            });
        }
    }

    return counts;
}

function planVoucherLedgerReconciliation(tallyEntries, sqlEntries) {
    if (!Array.isArray(tallyEntries) || !Array.isArray(sqlEntries)) {
        fail("RECONCILE_PLAN_INPUT_INVALID");
    }

    const grouped = new Map();
    const seenIds = new Set();

    function add(entries, sql) {
        for (const entry of entries) {
            const normalized = normalizeEntry(entry, sql, seenIds);

            if (!grouped.has(normalized.key)) {
                grouped.set(normalized.key, {
                    scope: normalized.scope,
                    tally: [],
                    sql: []
                });
            }

            grouped.get(normalized.key)[sql ? "sql" : "tally"]
                .push(normalized.occurrence);
        }
    }

    add(tallyEntries, false);
    add(sqlEntries, true);

    const groups = [...grouped.keys()].sort(compareText).map(key => {
        const group = grouped.get(key);
        const tallyCounts = countSignatures(group.tally);
        const sqlCounts = countSignatures(group.sql);

        const signatures = [...new Set([
            ...tallyCounts.keys(),
            ...sqlCounts.keys()
        ])].sort(compareText);

        const tallyOnly = [];
        const sqlOnly = [];

        for (const key of signatures) {
            const tally = tallyCounts.get(key);
            const sql = sqlCounts.get(key);
            const delta = (tally?.count || 0) - (sql?.count || 0);

            if (delta > 0) {
                tallyOnly.push({ ...tally, count: delta });
            } else if (delta < 0) {
                sqlOnly.push({ ...sql, count: -delta });
            }
        }

        let status;

        if (group.sql.length === 0) {
            status = "TALLY_ONLY";
        } else if (group.tally.length === 0) {
            status = "SQL_ONLY";
        } else if (tallyOnly.length === 0 && sqlOnly.length === 0) {
            status = "UNCHANGED";
        } else if (group.tally.length === 1 && group.sql.length === 1) {
            status = "UNVERIFIED_CHANGE";
        } else {
            status = "AMBIGUOUS_MATCH";
        }

        return {
            scope: group.scope,
            status,
            counts: {
                tally: group.tally.length,
                sql: group.sql.length
            },
            occurrences: {
                tally: group.tally,
                sql: group.sql
            },
            differences: {
                tallyOnly,
                sqlOnly
            }
        };
    });

    return {
        schemaVersion: 1,
        mode: "REPORT_ONLY",
        amountUnit: "RUPEES",
        differencePaiseUnit: "PAISE",
        groups
    };
}

module.exports = {
    planVoucherLedgerReconciliation
};
