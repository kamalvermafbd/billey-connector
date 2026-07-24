const { XMLParser } = require("fast-xml-parser");
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


function parseVoucherResponse(
    xml,
    lookups
) {

    const json = parser.parse(xml);

    const vouchers = toArray(
        json?.ENVELOPE?.BODY?.DATA?.COLLECTION?.VOUCHER
    );

  const fs = require("fs");

fs.writeFileSync(
    "./parser-lookups.json",
    JSON.stringify(
        {
            ledgerLookupSize: lookups?.ledgerLookup?.size,
            partyLookupSize: lookups?.partyLookup?.size,
            stockLookupSize: lookups?.stockLookup?.size,
            groupLookupSize: lookups?.groupLookup?.size
        },
        null,
        2
    ),
    "utf8"
);

fs.writeFileSync("./parsed-voucher-debug.json", "");

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
    inventory: parseVoucherInventory(v, lookups),
    raw: v
};

fs.appendFileSync(
    "./parsed-voucher-debug.json",
    JSON.stringify(parsedVoucher, null, 2) + "\n\n"
);

return parsedVoucher;

});

}

module.exports = {
    parseVoucherResponse
};