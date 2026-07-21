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

function parseBillAllocations(row) {

    return toArray(row["BILLALLOCATIONS.LIST"]).map(bill => ({

        billName: getValue(bill.NAME),

        billType: getValue(bill.BILLTYPE),

        amount: getNumber(bill.AMOUNT),

        dueDate: getValue(bill.DUEDATE),

        creditDays: getNumber(bill.CREDITPERIOD)

    }));

}

function parseCostCentreAllocations(row) {

    return toArray(row["CATEGORYALLOCATIONS.LIST"]).flatMap(category =>

        toArray(category["COSTCENTREALLOCATIONS.LIST"]).map(cc => ({

            category: getValue(category.CATEGORY),

            costCentre: getValue(cc.NAME),

            amount: getNumber(cc.AMOUNT)

        }))

    );

}

function parseVoucherLedgers(voucher) {

    const rows = [

        ...toArray(voucher["LEDGERENTRIES.LIST"]),

        ...toArray(voucher["ALLLEDGERENTRIES.LIST"])

    ];

    return rows.map(row => {

        const amount = getNumber(row.AMOUNT);

        const isDeemedPositive = getValue(row.ISDEEMEDPOSITIVE);

        return {

            ledgerName: getValue(row.LEDGERNAME),

            ledgerMasterId: getValue(row.LEDGERMASTERID),

            amount,

            debit: isDeemedPositive === "Yes"
                ? Math.abs(amount)
                : 0,

            credit: isDeemedPositive === "No"
                ? Math.abs(amount)
                : 0,

            isDeemedPositive,

            isPartyLedger: getValue(row.ISPARTYLEDGER),

            isLastDeemedPositive: getValue(row.ISLASTDEEMEDPOSITIVE),

            removeZeroEntries: getValue(row.REMOVEZEROENTRIES),

            billAllocations: parseBillAllocations(row),

            costCentreAllocations: parseCostCentreAllocations(row),

            raw: row

        };

    });

}

module.exports = {

    parseVoucherLedgers

};