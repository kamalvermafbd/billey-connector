
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

        masterId: getValue(v.MASTERID),

        voucherType: getValue(v.VOUCHERTYPENAME),

        voucherNumber: getValue(v.VOUCHERNUMBER),

        voucherDate: getValue(v.DATE),

        partyLedger: getValue(v.PARTYLEDGERNAME),

        narration: getValue(v.NARRATION),

        gstin: getValue(v.PARTYGSTIN),

        placeOfSupply: getValue(v.PLACEOFSUPPLY),

        buyerName: getValue(v.BASICBUYERNAME),

        gstRegistrationType: getValue(v.GSTREGISTRATIONTYPE),

        persistedView: getValue(v.PERSISTEDVIEW),

        isInvoice: getValue(v.ISINVOICE)

    };

}

module.exports = {

    parseVoucherHeader

};