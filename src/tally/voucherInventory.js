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

        amount: Number(getValue(a.AMOUNT) || 0)

    }));

}


function parseVoucherInventory(voucher) {

    const inventory = voucher["ALLINVENTORYENTRIES.LIST"];

    if (!inventory) {
        return [];
    }

    const items = Array.isArray(inventory)
        ? inventory
        : [inventory];

    return items.map(item => ({

        stockItem: getValue(item.STOCKITEMNAME),

        actualQty: getValue(item.ACTUALQTY),

        billedQty: getValue(item.BILLEDQTY),

        rate: getValue(item.RATE),

        amount: Number(getValue(item.AMOUNT) || 0),

        hsnCode: getValue(item.GSTHSNNAME),

        batches: parseBatchAllocations(item),

        accounting: parseAccountingAllocations(item),

        gstRates: parseRateDetails(item),

        raw: item

    }));

}

module.exports = {
    parseVoucherInventory,
    parseBatchAllocations,
    parseAccountingAllocations,
    parseRateDetails
};