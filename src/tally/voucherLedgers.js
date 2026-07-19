function toArray(value) {

    if (!value) return [];

    return Array.isArray(value)
        ? value
        : [value];

}

function getValue(v) {

    if (v == null) return "";

    if (typeof v === "string") return v;

    if (typeof v === "number") return v;

    if (typeof v === "object") {

        if ("#text" in v) return v["#text"];

        if ("TEXT" in v) return v.TEXT;

    }

    return "";

}

function getNumber(v) {

    const n = Number(getValue(v));

    return isNaN(n) ? 0 : n;

}

function parseVoucherLedgers(voucher) {

    const rows = [

        ...toArray(voucher["LEDGERENTRIES.LIST"]),

        ...toArray(voucher["ALLLEDGERENTRIES.LIST"])

    ];

    return rows.map(row => ({

        ledgerName: getValue(row.LEDGERNAME),

        amount: getNumber(row.AMOUNT),

        isDeemedPositive: getValue(row.ISDEEMEDPOSITIVE),

        isPartyLedger: getValue(row.ISPARTYLEDGER),

        isLastDeemedPositive: getValue(row.ISLASTDEEMEDPOSITIVE),

        removeZeroEntries: getValue(row.REMOVEZEROENTRIES),

        raw: row

    }));

}

module.exports = {

    parseVoucherLedgers

};