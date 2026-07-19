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

function parseUnitResponse(xml) {

    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "",
        parseTagValue: true,
        trimValues: true
    });

    const json = parser.parse(xml);

    const units =
        json?.ENVELOPE?.BODY?.DATA?.COLLECTION?.UNIT || [];

    const unitList = Array.isArray(units)
        ? units
        : [units];

    return unitList.map(unit => ({

        name: getValue(unit.NAME),

        reservedName: getValue(unit.RESERVEDNAME),

        raw: unit

    }));

}

module.exports = {
    parseUnitResponse
};