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

return vouchers.map(v => {

    const header = parseVoucherHeader(v);

    v.__header = header;

    return {
        header,
        ledgers: parseVoucherLedgers(v),
        inventory: parseVoucherInventory(
            v,
            lookups
        ),
        raw: v
    };

});

}

module.exports = {
    parseVoucherResponse
};