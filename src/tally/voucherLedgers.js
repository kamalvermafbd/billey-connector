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

function parseVoucherLedgers(
    voucher,
    lookups
) {
    

    const fs = require("fs");

fs.writeFileSync(
    "./ledger-parser-debug.json",
    JSON.stringify(
        {
            voucherType: getValue(voucher.VOUCHERTYPENAME),

            voucherNumber: getValue(voucher.VOUCHERNUMBER),

            ledgerEntriesCount:
                toArray(voucher["LEDGERENTRIES.LIST"]).length,

            allLedgerEntriesCount:
                toArray(voucher["ALLLEDGERENTRIES.LIST"]).length,

            ledgerEntries:
                toArray(voucher["LEDGERENTRIES.LIST"]).map(x => ({
                    ledger: getValue(x.LEDGERNAME),
                    amount: getValue(x.AMOUNT),
                    party: getValue(x.ISPARTYLEDGER)
                })),

            allLedgerEntries:
                toArray(voucher["ALLLEDGERENTRIES.LIST"]).map(x => ({
                    ledger: getValue(x.LEDGERNAME),
                    amount: getValue(x.AMOUNT),
                    party: getValue(x.ISPARTYLEDGER)
                }))
        },
        null,
        2
    )
);

const rows =
    toArray(voucher["ALLLEDGERENTRIES.LIST"]).length > 0
        ? toArray(voucher["ALLLEDGERENTRIES.LIST"])
        : toArray(voucher["LEDGERENTRIES.LIST"]);

const ledgerLookup = lookups?.ledgerLookup;
const groupLookup = lookups?.groupLookup;


    return rows.map(row => {

            const ledger =
                ledgerLookup?.get(
                    getValue(row.LEDGERNAME)
                        .trim()
                        .toUpperCase()
                );

            const ledgerParent =
                ledger
                    ? groupLookup?.get(
                        (ledger.parent || "")
                            .trim()
                            .toUpperCase()
                    )
                    : null;

                    fs.appendFileSync(
    "./ledger-parent232-debug.txt",
    JSON.stringify({
        ledger: ledger?.name,
        parent: ledgerParent?.name,
        parentAlterId: ledgerParent?.alterId,
        parentMasterId: ledgerParent?.masterId
    }) + "\n"
);
                    
        const amount = getNumber(row.AMOUNT);

        const isDeemedPositive = getValue(row.ISDEEMEDPOSITIVE);

        return {

          
            ledgerName:
                ledger?.name ||
                getValue(row.LEDGERNAME),

            ledgerGuid:
                ledger?.guid || null,

            ledgerMasterId:
                ledger?.masterId ||
                getValue(row.LEDGERMASTERID),

            ledgerAlterId:
                ledger?.alterId || null,

            ledgerParentName:
                ledgerParent?.name ||
                ledger?.parent ||
                null,

            ledgerParentGuid:
                ledgerParent?.guid || null,

            ledgerParentMasterId:
                ledgerParent?.masterId || null,

            ledgerParentAlterId:
                ledgerParent?.alterId || null,


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