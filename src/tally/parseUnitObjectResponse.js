const { XMLParser } = require("fast-xml-parser");

function getValue(node) {
    if (node == null) return "";
    if (typeof node === "string") return node.trim();
    if (typeof node === "number") return node;
    if (typeof node === "boolean") return node;
    if (typeof node === "object" && "#text" in node)
        return String(node["#text"]).trim();
    return "";
}

function parseUnitObjectResponse(xml) {

    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "",
        parseTagValue: true,
        trimValues: true
    });

    const json = parser.parse(xml);

    const unit = json?.ENVELOPE?.BODY?.DATA?.TALLYMESSAGE?.UNIT;

    if (!unit) return null;

   return {
    guid: getValue(unit.GUID),

    masterid: getValue(unit.MASTERID),
    alterid: getValue(unit.ALTERID),

    name: getValue(unit.NAME),
    formalName: getValue(unit.FORMALNAME),
    decimalPlaces: getValue(unit.DECIMALPLACES),
    reservedName: getValue(unit.RESERVEDNAME),

    raw: unit
};
}

module.exports = {
    parseUnitObjectResponse
};