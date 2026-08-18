const { XMLParser } = require("fast-xml-parser");

const fs = require("fs");

const { parseVoucherHeader } = require("./voucherHeader");
const { parseVoucherLedgers } = require("./voucherLedgers");
const { parseVoucherInventory } = require("./voucherInventory");

// Future
// const { parseBankAllocations } = require("./voucherBank");
// const { parsePayroll } = require("./voucherPayroll");

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    parseTagValue: true,
    trimValues: true
});

function toArray(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}

function parseVoucherGuidResponse(xml) {

    const json = parser.parse(xml);

    console.log("=== PARSER DEBUG ===");
console.dir(json?.ENVELOPE?.BODY, { depth: 6 });
console.log(
    "COLLECTION:",
    json?.ENVELOPE?.BODY?.DATA?.COLLECTION
);
console.log("====================");

    require("fs").writeFileSync(
    "./logs/one-voucher-response.json",
    JSON.stringify(json, null, 2),
    "utf8"
);

    const vouchers = toArray(
        json?.ENVELOPE?.BODY?.DATA?.COLLECTION?.VOUCHER
    );

   console.log(
    "PARSER VOUCHER COUNT:",
    vouchers.length
);

    return vouchers.map(v => ({

        guid: v.GUID || null,

        alterid: Number(
    v.ALTERID?.["#text"] ??
    v.ALTERID ??
    0
)

    }));

}

function parseVoucherResponse(
    xml,
    lookups
) {

    const json = parser.parse(xml);

       const vouchers = toArray(
        json?.ENVELOPE?.BODY?.DATA?.COLLECTION?.VOUCHER
    );




return vouchers.map(v => {

    const header = parseVoucherHeader(v);

    v.__header = header;

  const ledgers = parseVoucherLedgers(
    v,
    lookups
);


const parsedVoucher = {
    header,
    ledgers,
    inventory: parseVoucherInventory(
        v,
        lookups,
        ledgers
    )
};

if (process.env.INTEGRITY_DEBUG === "true") {
    parsedVoucher.raw = v;
}
// ======================================
// RAW vs PARSED AUDIT
// ======================================

const audit = [];

function mark(rawTag, parsedLocation) {

    audit.push({
        rawTag,
        parsed:
            parsedLocation || "❌ NOT PARSED"
    });

}

const rawKeys = Object.keys(v || {}).sort();

// --------------------
// Header Mapping
// --------------------

const headerMap = {

    GUID: "header.guid",
    MASTERID: "header.masterid",
    ALTERID: "header.alterid",
    DATE: "header.voucherDate",
    EFFECTIVEDATE: "header.effectiveDate",
    VOUCHERTYPENAME: "header.voucherTypeName",
    VOUCHERNUMBER: "header.voucherNumber",
    REFERENCE: "header.reference",
    REFERENCEDATE: "header.referenceDate",
    PARTYLEDGERNAME: "header.partyLedger",
    NARRATION: "header.narration",
    PARTYGSTIN: "header.gstin",
    PLACEOFSUPPLY: "header.placeOfSupply",
    BASICBUYERNAME: "header.buyerName",
    BASICBUYERADDRESS: "header.buyerAddress",
    GSTREGISTRATIONTYPE: "header.gstRegistrationType",
    PERSISTEDVIEW: "header.persistedView",
    ISINVOICE: "header.isInvoice",
    ISOPTIONAL: "header.isOptional",
    ISCANCELLED: "header.isCancelled",

    "ALLLEDGERENTRIES.LIST":
        "ledgers[]",

    "ALLINVENTORYENTRIES.LIST":
        "inventory[]",

    "INVENTORYENTRIESIN.LIST":
        "inventory[]",

    "INVENTORYENTRIESOUT.LIST":
        "inventory[]"
};

for (const key of rawKeys) {

    mark(
        key,
        headerMap[key]
    );

}

/*
fs.appendFileSync(

    "./logs/raw-vs-parsed-audit.jsonl",

    JSON.stringify({

        voucher:
            header.voucherNumber,

        guid:
            header.guid,

        totalRawTags:
            rawKeys.length,

        totalParsed:

            Object
                .values(headerMap)
                .filter(Boolean)
                .length,

        audit

    }, null, 2)

    + "\n\n"

);
*/


return parsedVoucher;

});

}

module.exports = {
    parseVoucherResponse,
    parseVoucherGuidResponse
};