const { XMLParser } = require("fast-xml-parser");

function getValue(node) {

    if (node == null) return "";

    if (typeof node === "string")
        return node.trim();

    if (typeof node === "number")
        return node;

    if (typeof node === "boolean")
        return node;

    if (typeof node === "object" && "#text" in node)
        return String(node["#text"]).trim();

    return "";

}

function parseLedgerResponse(xml) {

    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "",
        parseTagValue: true,
        trimValues: true
    });

    const json = parser.parse(xml);

    const ledgers =
        json?.ENVELOPE?.BODY?.DATA?.COLLECTION?.LEDGER || [];

    const ledgerList = Array.isArray(ledgers)
        ? ledgers
        : [ledgers];

    return ledgerList.map(ledger => ({

        name: getValue(ledger.NAME),

        parent: getValue(ledger.PARENT),

        reservedName: getValue(ledger.RESERVEDNAME),

        raw: ledger

    }));

}

module.exports = {
    parseLedgerResponse
};