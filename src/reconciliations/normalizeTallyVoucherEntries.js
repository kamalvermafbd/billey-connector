"use strict";

// Validate rupee amounts without rounding or losing decimal-string precision.
function validateTallyAmount(value) {
    if (value === null || value === undefined) {
        throw new Error("RECONCILE_LEDGER_AMOUNT_MISSING");
    }

    const isNumber = typeof value === "number";

    if (
        (!isNumber && typeof value !== "string") ||
        (isNumber && !Number.isFinite(value))
    ) {
        throw new Error("RECONCILE_LEDGER_AMOUNT_INVALID");
    }

    const text = String(value).trim();

    if (text.startsWith("-") || Object.is(value, -0)) {
        throw new Error("RECONCILE_LEDGER_AMOUNT_INVALID");
    }

    const match =
        /^\+?(?:(\d+)(?:\.(\d{1,2}))?|\.(\d{1,2}))$/.exec(text);

    if (!match || (isNumber && value >= 2 ** 46)) {
        throw new Error("RECONCILE_LEDGER_AMOUNT_INVALID");
    }

    const whole = match[1] || "0";
    const fraction = (match[2] || match[3] || "").padEnd(2, "0");

    const paise = BigInt(whole) * 100n + BigInt(fraction);

    if (paise > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error("RECONCILE_LEDGER_AMOUNT_INVALID");
    }

    return isNumber ? value : text;
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

                       const debit = validateTallyAmount(ledger.debit);
            const credit = validateTallyAmount(ledger.credit);

            entries.push({
                companyCode,
                tallyOwner,
                voucherGuid,
                ledgerGuid,
                debit,
                credit
            });
        }
    }

    return entries;
}

module.exports = {
    normalizeTallyVoucherEntries
};