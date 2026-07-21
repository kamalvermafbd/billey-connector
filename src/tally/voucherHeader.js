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

function parseVoucherHeader(v) {

    return {

    guid: getValue(v.GUID),

    masterid: getValue(v.MASTERID),

    alterid: getValue(v.ALTERID),

    voucherType: getValue(v.VOUCHERTYPENAME),

    voucherNumber: getValue(v.VOUCHERNUMBER),

    voucherDate: getValue(v.DATE),

    effectiveDate: getValue(v.EFFECTIVEDATE),

    reference: getValue(v.REFERENCE),

    referenceDate: getValue(v.REFERENCEDATE),

    partyLedger: getValue(v.PARTYLEDGERNAME),

    narration: getValue(v.NARRATION),

    gstin: getValue(v.PARTYGSTIN),

    placeOfSupply: getValue(v.PLACEOFSUPPLY),

    buyerName: getValue(v.BASICBUYERNAME),

    buyerAddress: getValue(v.BASICBUYERADDRESS),

    gstRegistrationType: getValue(v.GSTREGISTRATIONTYPE),

    persistedView: getValue(v.PERSISTEDVIEW),

    isInvoice: getValue(v.ISINVOICE),

    isOptional: getValue(v.ISOPTIONAL),

    isCancelled: getValue(v.ISCANCELLED)

};

}

module.exports = {

    parseVoucherHeader

};