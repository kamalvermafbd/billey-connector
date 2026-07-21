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

function parseVoucherTypeResponse(xml) {

    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "",
        parseTagValue: true,
        trimValues: true
    });

    const json = parser.parse(xml);

    const voucherTypes =
        json?.ENVELOPE?.BODY?.DATA?.COLLECTION?.VOUCHERTYPE || [];

    const list = Array.isArray(voucherTypes)
        ? voucherTypes
        : voucherTypes
            ? [voucherTypes]
            : [];

return list.map(type => ({

    name: getValue(type.NAME),

    parent: getValue(type.PARENT),

    reservedName: getValue(type.RESERVEDNAME),

    numberingMethod: getValue(type.NUMBERINGMETHOD),

    useZeroEntries:
        String(getValue(type.USEZEROENTRIES)).toUpperCase() === "YES",

    isActive:
        String(getValue(type.ISACTIVE)).toUpperCase() === "YES",

    printAfterSave:
        String(getValue(type.PRINTAFTERSAVE)).toUpperCase() === "YES",

    isOptional:
        String(getValue(type.ISOPTIONAL)).toUpperCase() === "YES",

    commonNarration:
        String(getValue(type.COMMONNARRATION)).toUpperCase() === "YES",

    isDefaultAllocationEnabled:
        String(getValue(type.ISDEFAULTALLOCENABLED)).toUpperCase() === "YES",

    raw: type

}));

}

module.exports = {
    parseVoucherTypeResponse
};