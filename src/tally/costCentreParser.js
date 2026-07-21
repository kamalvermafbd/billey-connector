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

function parseCostCentreResponse(xml) {

    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "",
        parseTagValue: true,
        trimValues: true
    });

    const json = parser.parse(xml);

    const centres =
        json?.ENVELOPE?.BODY?.DATA?.COLLECTION?.COSTCENTRE || [];

    const list = Array.isArray(centres)
        ? centres
        : centres
            ? [centres]
            : [];

  return list.map(cc => ({

    guid: getValue(cc.GUID),

    masterid: Number(getValue(cc.MASTERID)) || 0,

    alterid: Number(getValue(cc.ALTERID)) || 0,

    name: getValue(cc.NAME),

    parent: getValue(cc.PARENT),

    category: getValue(cc.CATEGORY),

    reservedName: getValue(cc.RESERVEDNAME),

    raw: cc

}));

}

module.exports = {
    parseCostCentreResponse
};