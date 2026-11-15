
"use strict";

const AMOUNT_SCALE = 1000000n;
const MAX_AMOUNT_UNITS = BigInt(Number.MAX_SAFE_INTEGER);

// Validate rupee amounts without rounding or losing
// decimal-string precision.
function validateTallyAmount(value) {
    if (value === null || value === undefined) {
        throw new Error("RECONCILE_LEDGER_AMOUNT_MISSING");
    }

    // Reconciliation amounts must be exact strings.
    // Floating-point numbers cannot prove XML precision.
    if (typeof value !== "string") {
        throw new Error("RECONCILE_LEDGER_AMOUNT_INVALID");
    }

    const text = value.trim();

    const match =
        /^\+?(?:(\d+)(?:\.(\d{1,6}))?|\.(\d{1,6}))$/
            .exec(text);

    if (!match) {
        throw new Error("RECONCILE_LEDGER_AMOUNT_INVALID");
    }

    const whole = match[1] || "0";
    const fraction =
        (match[2] || match[3] || "").padEnd(6, "0");

    const units =
        BigInt(whole) * AMOUNT_SCALE + BigInt(fraction);

    if (units > MAX_AMOUNT_UNITS) {
        throw new Error("RECONCILE_LEDGER_AMOUNT_INVALID");
    }

    return `${units / AMOUNT_SCALE}.${String(
        units % AMOUNT_SCALE
    ).padStart(6, "0")}`;
}

// Preserve independently signed Tally XML AMOUNT.
// Never derive its sign from debit or credit.
function validateSignedTallyAmount(value) {
    if (
        typeof value !== "string" ||
        value !== value.trim() ||
        !/^-?(?:0|[1-9]\d*)\.\d{6}$/.test(value)
    ) {
        throw new Error(
            "RECONCILE_LEDGER_SIGNED_AMOUNT_INVALID"
        );
    }

    const negative = value.startsWith("-");
    const unsigned = negative ? value.slice(1) : value;
    const [whole, fraction] = unsigned.split(".");

    const units =
        BigInt(whole) * AMOUNT_SCALE + BigInt(fraction);

    if (units > MAX_AMOUNT_UNITS) {
        throw new Error(
            "RECONCILE_LEDGER_SIGNED_AMOUNT_OUT_OF_RANGE"
        );
    }

    if (units === 0n) {
        return "0.000000";
    }

    return value;
}

function normalizeTallyVoucherEntries(
    vouchers,
    { companyCode, tallyOwner } = {}
) {
    companyCode = String(companyCode || "").trim();
    tallyOwner = String(tallyOwner || "").trim();

    if (
        !companyCode ||
        !["USER", "CA"].includes(tallyOwner)
    ) {
        throw new Error("RECONCILE_TALLY_SCOPE_INVALID");
    }

    if (!Array.isArray(vouchers)) {
        throw new TypeError("RECONCILE_VOUCHERS_INVALID");
    }

    const entries = [];

    for (const voucher of vouchers) {
        const voucherGuid = String(
            voucher?.header?.guid || ""
        ).trim();

        if (!voucherGuid) {
            throw new Error("RECONCILE_VOUCHER_GUID_MISSING");
        }

        if (!Array.isArray(voucher.ledgers)) {
            throw new Error("RECONCILE_VOUCHER_LEDGERS_INVALID");
        }

        for (const ledger of voucher.ledgers) {
            const ledgerGuid = String(
                ledger?.ledgerGuid || ""
            ).trim();

            if (!ledgerGuid) {
                throw new Error("RECONCILE_LEDGER_GUID_MISSING");
            }

            const amount =
                validateSignedTallyAmount(ledger.amount);

            const debit =
                validateTallyAmount(ledger.debit);

            const credit =
                validateTallyAmount(ledger.credit);

            if (
                !ledger.raw ||
                typeof ledger.raw !== "object" ||
                Array.isArray(ledger.raw) ||
                !Array.isArray(ledger.billAllocations) ||
                !Array.isArray(ledger.costCentreAllocations)
            ) {
                throw new Error(
                    "RECONCILE_LEDGER_STRUCTURAL_EVIDENCE_MISSING"
                );
            }

            const requiresStructuralReview =
                ledger.billAllocations.length > 0 ||
                ledger.costCentreAllocations.length > 0 ||
                Object.prototype.hasOwnProperty.call(
                    ledger.raw,
                    "BILLALLOCATIONS.LIST"
                ) ||
                Object.prototype.hasOwnProperty.call(
                    ledger.raw,
                    "CATEGORYALLOCATIONS.LIST"
                );

            entries.push({
                companyCode,
                tallyOwner,
                voucherGuid,
                ledgerGuid,
                amount,
                debit,
                credit,
                requiresStructuralReview
            });
        }
    }

    return entries;
}

module.exports = {
    normalizeTallyVoucherEntries
};
