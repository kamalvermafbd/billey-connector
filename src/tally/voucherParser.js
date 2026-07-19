const { XMLParser } = require("fast-xml-parser");
const { parseVoucherHeader } = require("./voucherHeader");
const { parseVoucherLedgers } = require("./voucherLedgers");
const { parseVoucherInventory } = require("./voucherInventory");

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


function parseVoucherResponse(xml) {

    const json = parser.parse(xml);

    const vouchers = toArray(
        json?.ENVELOPE?.BODY?.DATA?.COLLECTION?.VOUCHER
    );

   return vouchers.map(v => ({
    header: parseVoucherHeader(v),
    ledgers: parseVoucherLedgers(v),
    inventory: parseVoucherInventory(v),
    raw: v
}));

}

module.exports = {
    parseVoucherResponse
};