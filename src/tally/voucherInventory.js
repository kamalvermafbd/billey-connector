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

        batchName: getValue(batch.BATCHNAME),

        actualQty: getValue(batch.ACTUALQTY),

        billedQty: getValue(batch.BILLEDQTY),

        rate: getValue(batch.BATCHRATE),

        amount: Number(getValue(batch.AMOUNT) || 0)

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

function parseVoucherInventory(voucher) {

    const inventory = voucher["ALLINVENTORYENTRIES.LIST"];

    if (!inventory) {
        return [];
    }

    const items = Array.isArray(inventory)
        ? inventory
        : [inventory];

    return items.map(item => {

        const batches = parseBatchAllocations(item);

        return {

            stockItem: getValue(item.STOCKITEMNAME),

            stockMasterId: getValue(item.STOCKITEMMASTERID),

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

            batches,

            accounting: parseAccountingAllocations(item),

            gstRates: parseRateDetails(item),

            costCentreAllocations: parseCostCentreAllocations(item),

            raw: item

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