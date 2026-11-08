"use strict";

const MAX_PAISE = BigInt(Number.MAX_SAFE_INTEGER);

function fail(code) {
    throw new Error(code);
}

// Accept scalar text or a simple text-node wrapper.
// Numeric raw values cannot establish original XML precision.
function requireRawText(value, field) {
    if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value)
    ) {
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

function decimalParts(text, signed) {
    const pattern = signed
        ? /^([+-]?)(?:(\d+)(?:\.(\d{1,2}))?|\.(\d{1,2}))$/
        : /^(\+?)(?:(\d+)(?:\.(\d{1,2}))?|\.(\d{1,2}))$/;

    const match = pattern.exec(text);

    if (!match) {
        fail("RECONCILE_RAW_AMOUNT_INVALID");
    }

    const whole = match[2] || "0";
    const fraction = (match[3] || match[4] || "").padEnd(2, "0");

    const magnitude =
        BigInt(whole) * 100n + BigInt(fraction);

    if (magnitude > MAX_PAISE) {
        fail("RECONCILE_RAW_AMOUNT_OUT_OF_RANGE");
    }

    return { magnitude };
}

function parsedPaise(value) {
    const isNumber = typeof value === "number";

    if (
        (!isNumber && typeof value !== "string") ||
        (isNumber && !Number.isFinite(value))
    ) {
        fail("RECONCILE_PARSED_AMOUNT_INVALID");
    }

    const text = String(value).trim();

    if (
        text.startsWith("-") ||
        Object.is(value, -0) ||
        (isNumber && value >= 2 ** 46)
    ) {
        fail("RECONCILE_PARSED_AMOUNT_INVALID");
    }

    return decimalParts(text, false).magnitude;
}

function rupees(paise) {
    return `${paise / 100n}.${String(paise % 100n).padStart(2, "0")}`;
}

function validateLedger(ledger) {
    if (
        !ledger ||
        typeof ledger !== "object" ||
        Array.isArray(ledger)
    ) {
        fail("RECONCILE_LEDGER_INVALID");
    }

    const raw = ledger.raw;

    if (
        !raw ||
        typeof raw !== "object" ||
        Array.isArray(raw)
    ) {
        fail("RECONCILE_RAW_LEDGER_REQUIRED");
    }

    if (
        !Object.prototype.hasOwnProperty.call(raw, "AMOUNT") ||
        !Object.prototype.hasOwnProperty.call(
            raw,
            "ISDEEMEDPOSITIVE"
        )
    ) {
        fail("RECONCILE_RAW_LEDGER_INCOMPLETE");
    }

    const amountText = requireRawText(
        raw.AMOUNT,
        "AMOUNT"
    );

    const direction = requireRawText(
        raw.ISDEEMEDPOSITIVE,
        "DIRECTION"
    );

    if (direction !== "Yes" && direction !== "No") {
        fail("RECONCILE_RAW_DIRECTION_INVALID");
    }

    const { magnitude } = decimalParts(
        amountText,
        true
    );

    const expectedDebit =
        direction === "Yes" ? magnitude : 0n;

    const expectedCredit =
        direction === "No" ? magnitude : 0n;

    if (
        parsedPaise(ledger.debit) !== expectedDebit ||
        parsedPaise(ledger.credit) !== expectedCredit
    ) {
        fail("RECONCILE_RAW_PARSED_AMOUNT_MISMATCH");
    }

    // Preserve identity, raw evidence and occurrence order.
    // Amounts remain exact decimal strings in rupees.
    return {
        ...ledger,
        debit: rupees(expectedDebit),
        credit: rupees(expectedCredit)
    };
}

function validateRawTallyVoucherLedgerAmounts(vouchers) {
    if (!Array.isArray(vouchers)) {
        fail("RECONCILE_VOUCHERS_INVALID");
    }

    return vouchers.map(voucher => {
        if (
            !voucher ||
            typeof voucher !== "object" ||
            !Array.isArray(voucher.ledgers) ||
            voucher.ledgers.length === 0
        ) {
            fail("RECONCILE_RAW_VOUCHER_LEDGERS_REQUIRED");
        }

        return {
            ...voucher,
            ledgers: voucher.ledgers.map(validateLedger)
        };
    });
}

module.exports = {
    validateRawTallyVoucherLedgerAmounts
};