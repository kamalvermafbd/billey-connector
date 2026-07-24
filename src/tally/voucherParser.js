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



return parsedVoucher;

});

}

module.exports = {
    parseVoucherResponse
};