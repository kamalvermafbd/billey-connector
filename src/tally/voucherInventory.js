const fs = require("fs");

const INVENTORY_DEBUG_FILE = "./logs/inventory-debug.jsonl";

function getValue(value) {
    if (
        value &&
        typeof value === "object" &&
        "#text" in value
    ) {
        return value["#text"];
    }

    return value ?? "";
}

function getNumber(value) {

    const n = Number(getValue(value));

    return isNaN(n) ? 0 : n;

}

function getQuantityValue(value) {

    const str = String(getValue(value));

    const match = str.match(/-?\d+(\.\d+)?/);

    return match ? Number(match[0]) : 0;

}

function getQuantityUnit(value) {

    const str = String(getValue(value)).trim();

    const parts = str.split(/\s+/);

    return parts.length >= 2 ? parts.slice(1).join(" ") : "";

}

function getRateValue(value) {

    const str = String(getValue(value));

    const match = str.match(/-?\d+(\.\d+)?/);

    return match ? Number(match[0]) : 0;

}

function parseBatchAllocations(item) {

    const batches = item["BATCHALLOCATIONS.LIST"];

    if (!batches) {
        return [];
    }

    const list = Array.isArray(batches)
        ? batches
        : [batches];

    return list.map(batch => ({

    godown: getValue(batch.GODOWNNAME),

    destinationGodown:
        getValue(batch.DESTINATIONGODOWNNAME),

    batchName:
        getValue(batch.BATCHNAME),

batchId:
    batch.BATCHID
        ? getNumber(batch.BATCHID)
        : null,
        
        actualQty:
        getValue(batch.ACTUALQTY),

    billedQty:
        getValue(batch.BILLEDQTY),

    rate:
        getValue(batch.BATCHRATE),

    rateValue:
        getRateValue(batch.BATCHRATE),

    amount:
        Number(getValue(batch.AMOUNT) || 0),

    additionalAmount:
        getNumber(batch.ADDLAMOUNT),

    discount:
        getNumber(batch.BATCHDISCOUNT)

}));

}

function parseRateDetails(item) {

    const rates = item["RATEDETAILS.LIST"];

    if (!rates) {
        return [];
    }

    const list = Array.isArray(rates)
        ? rates
        : [rates];

    return list.map(rate => ({

        dutyHead: getValue(rate.GSTRATEDUTYHEAD),

        valuationType: getValue(rate.GSTRATEVALUATIONTYPE),

        rate: Number(getValue(rate.GSTRATE) || 0),

        perUnit: Number(getValue(rate.GSTRATEPERUNIT) || 0)

    }));

}

function parseTaxBreakup(
    voucher,
    item,
    ledgerLookup
) {
    let taxableAmount = 0;

    const accounting = parseAccountingAllocations(item);

const gstRates = parseRateDetails(item);

const cgstRate =
    gstRates.find(r => r.dutyHead === "CGST")?.rate ?? 0;

const sgstRate =
    gstRates.find(r => r.dutyHead === "SGST/UTGST")?.rate ?? 0;

const igstRate =
    gstRates.find(r => r.dutyHead === "IGST")?.rate ?? 0;

let cgstAmount = 0;
let sgstAmount = 0;
let igstAmount = 0;

   for (const a of accounting) {

    const name = (a.ledgerName || "").toUpperCase();

    const voucherLedger =
        ledgerLookup?.get(name);

  if (!voucherLedger) {
    continue;
}

taxableAmount += Math.abs(a.amount || 0);

const ledgerName =
    (voucherLedger.name || a.ledgerName || "")
        .toUpperCase();

if (ledgerName.includes("IGST")) {

    cgstAmount = 0;
    sgstAmount = 0;
    igstAmount =
        +(taxableAmount * igstRate / 100).toFixed(2);

} else {

    cgstAmount =
        +(taxableAmount * cgstRate / 100).toFixed(2);

    sgstAmount =
        +(taxableAmount * sgstRate / 100).toFixed(2);

    igstAmount = 0;

}
   }

   return {
    taxableAmount,

    cgstRate,
    sgstRate,
    igstRate,

    cgstAmount,
    sgstAmount,
    igstAmount
};

}


function parseAccountingAllocations(item) {

    const allocations = item["ACCOUNTINGALLOCATIONS.LIST"];

    if (!allocations) {
        return [];
    }

    const list = Array.isArray(allocations)
        ? allocations
        : [allocations];

   return list.map(a => ({

    ledgerName: getValue(a.LEDGERNAME),

    ledgerMasterId: getValue(a.LEDGERMASTERID),

    amount: getNumber(a.AMOUNT)

}));

}

function parseCostCentreAllocations(item) {

    const categories = item["CATEGORYALLOCATIONS.LIST"];

    if (!categories) {
        return [];
    }

    const list = Array.isArray(categories)
        ? categories
        : [categories];

    return list.flatMap(category => {

        const centres = category["COSTCENTREALLOCATIONS.LIST"];

        if (!centres) {
            return [];
        }

        const ccList = Array.isArray(centres)
            ? centres
            : [centres];

        return ccList.map(cc => ({

            category: getValue(category.CATEGORY),

            costCentre: getValue(cc.NAME),

            amount: getNumber(cc.AMOUNT)

        }));

    });

}

function parseVoucherInventory(
    voucher,
    lookups
) {

    
    const header = voucher.__header || {};

    global.lookupDebug ??= [];

    global.lookupDebug = [];

    const ledgerLookup = lookups?.ledgerLookup;
    const stockLookup = lookups?.stockLookup;
    const partyLookup = lookups?.partyLookup;

const groupLookup = lookups?.groupLookup;

const inventory = voucher["ALLINVENTORYENTRIES.LIST"];

const inventoryIn = voucher["INVENTORYENTRIESIN.LIST"];

const inventoryOut = voucher["INVENTORYENTRIESOUT.LIST"];

const items = [];


function addInventoryItems(source, movementType, inventoryNode) {

    if (!source) return;

    const list = Array.isArray(source)
        ? source
        : [source];

    items.push(
        ...list.map(row => ({
            ...row,
            __movementType: movementType,
            __inventoryNode: inventoryNode
        }))
    );

}



addInventoryItems(
    inventory,
    null,
    "ALLINVENTORYENTRIES.LIST"
);

addInventoryItems(
    inventoryIn,
    "IN",
    "INVENTORYENTRIESIN.LIST"
);

addInventoryItems(
    inventoryOut,
    "OUT",
    "INVENTORYENTRIESOUT.LIST"
);

fs.appendFileSync(
    INVENTORY_DEBUG_FILE,
    JSON.stringify({
        voucher: header.voucherNumber,
        guid: header.guid,
        all: Array.isArray(inventory)
            ? inventory.length
            : inventory ? 1 : 0,
        in: Array.isArray(inventoryIn)
            ? inventoryIn.length
            : inventoryIn ? 1 : 0,
        out: Array.isArray(inventoryOut)
            ? inventoryOut.length
            : inventoryOut ? 1 : 0,
        total: items.length
    }) + "\n"
);

if (items.length === 0) {
    return [];
}    
    

    return items.map(item => {

        const movementType = item.__movementType;

const inventoryNode = item.__inventoryNode;

    const batches = parseBatchAllocations(item);

    const accounting =
        parseAccountingAllocations(item);

    const tax = parseTaxBreakup(
        voucher,
        item,
        ledgerLookup
    );

    const lookupKey = (header.partyLedger || "").trim().toUpperCase();

const stockKey = getValue(item.STOCKITEMMASTERID);


//const stock = stockLookup?.get(stockKey);

let stock = stockLookup?.get(stockKey);

if (!stock) {
    stock = [...stockLookup.values()].find(
        s =>
            (s.name || "").trim().toUpperCase() ===
            (getValue(item.STOCKITEMNAME) || "").trim().toUpperCase()
    );
}

const party = partyLookup?.get(lookupKey);



    /* const stock =
        stockLookup?.get(
            getValue(item.STOCKITEMMASTERID)
        );



    const party =
        partyLookup?.get(
            (header.partyLedger || "")
                .toUpperCase()
        );
*/
    global.lookupDebug.push({
    type: "party",
    lookupKey: (header.partyLedger || "").toUpperCase(),
    originalParty: header.partyLedger,

    lookupsExists: !!lookups,
    partyLookupExists: !!partyLookup,

    partyLookupSize: partyLookup?.size,

    hasKey: partyLookup?.has(
        (header.partyLedger || "").toUpperCase()
    ),

    foundParty: party || null
});

        console.log(
    "LOOKUP PARTY:",
    header.partyLedger,
    party
);

    const ledger =
        ledgerLookup?.get(
            (
                accounting[0]?.ledgerName || ""
            ).toUpperCase()
        );


global.lookupDebug.push({
    type: "ledger",
    lookupKey: (
        accounting[0]?.ledgerName || ""
    ).toUpperCase(),
    originalLedger: accounting[0]?.ledgerName,
    foundLedger: ledger || null
});

        console.log(
    "LOOKUP LEDGER:",
    accounting[0]?.ledgerName,
    ledger
);


   const ledgerParent =
    ledger
        ? groupLookup?.get(
            (ledger.parent || "").trim().toUpperCase()
        )
        : null;

            console.log("LEDGER PARENT", ledgerParent);

const partyParent =
    party
        ? groupLookup?.get(
            (party.parent || "").trim().toUpperCase()
        )
        : null;

            console.log("PARTY PARENT", partyParent);

const {
    __movementType,
    __inventoryNode,
    ...rawItem
} = item;


        return {

                     voucherGuid: header.guid,

            voucherMasterId: header.masterid,

            voucherAlterId: header.alterid,

            voucherTypeName:
                header.voucherTypeName,

            voucherDate: header.voucherDate,

            voucherType: header.voucherType,

            transactionType: header.isInvoice,

            stockItem: getValue(item.STOCKITEMNAME),

            movementType,

            inventoryNode,

            stockMasterId: getValue(item.STOCKITEMMASTERID),

            stockGuid: stock?.guid || null,

            stockMasterIdResolved: stock?.masterId || null,

            stockAlterId: stock?.alterId || null,

            actualQty: getValue(item.ACTUALQTY),

            actualQtyValue: getQuantityValue(item.ACTUALQTY),

            billedQty: getValue(item.BILLEDQTY),

            billedQtyValue: getQuantityValue(item.BILLEDQTY),

            unit:
                getValue(item.BASEUNITS) ||
                getQuantityUnit(item.ACTUALQTY) ||
                getQuantityUnit(item.BILLEDQTY),

            rate: getValue(item.RATE),

            rateValue: getRateValue(item.RATE),

            amount: getNumber(item.AMOUNT),

            hsnCode: getValue(item.GSTHSNNAME),

            discount: getNumber(item.DISCOUNT),

            godown:
                getValue(item.GODOWNNAME) ||
                batches[0]?.godown ||
                null,

                     batchName:
                batches[0]?.batchName || null,

            batchId:
                batches[0]?.batchId || null,

            batchRate:
                batches[0]?.rate || null,

            batchRateValue:
                batches[0]?.rateValue || null,

            batchAmount:
                batches[0]?.amount ?? null,

            additionalAmount:
                batches[0]?.additionalAmount ?? null,

            destinationGodown:
                batches[0]?.destinationGodown || null,

            batches,
           accounting,

            ledgerName: ledger?.name || accounting[0]?.ledgerName || null,

            ledgerGuid: ledger?.guid || null,

            ledgerMasterId: ledger?.masterId || null,

            ledgerAlterId: ledger?.alterId || null,

            ledgerParentName: ledger?.parent || null,

            ledgerParentGuid:
                ledgerParent?.guid || null,

            ledgerParentMasterId:
                ledgerParent?.masterId || null,

            ledgerParentAlterId:
                ledgerParent?.alterId || null,

            partyName: party?.name || header.partyLedger || null,

            partyGuid: party?.guid || null,

            partyMasterId: party?.masterId || null,

            partyAlterId: party?.alterId || null,

            partyParentName:
                partyParent?.name || party?.parent || null,

            partyParentGuid:
                partyParent?.guid || null,

            partyParentMasterId:
                partyParent?.masterId || null,

            partyParentAlterId:
                partyParent?.alterId || null,

            gstRates: parseRateDetails(item),

            taxableAmount: tax.taxableAmount,

            cgstRate: tax.cgstRate,
            sgstRate: tax.sgstRate,
            igstRate: tax.igstRate,

            cgstAmount: tax.cgstAmount,

            sgstAmount: tax.sgstAmount,

            igstAmount: tax.igstAmount,

            costCentreAllocations: parseCostCentreAllocations(item),

            raw: rawItem

        };

    });

}

module.exports = {
    parseVoucherInventory,
    parseBatchAllocations,
    parseAccountingAllocations,
    parseRateDetails,
    parseCostCentreAllocations
};