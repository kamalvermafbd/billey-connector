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

function parseStockGroupResponse(xml) {

    const parser = new XMLParser({

        ignoreAttributes: false,
        attributeNamePrefix: "",
        parseTagValue: true,
        trimValues: true

    });

    const json = parser.parse(xml);

    const groups =
        json?.ENVELOPE?.BODY?.DATA?.COLLECTION?.STOCKGROUP || [];

    const groupList = Array.isArray(groups)
        ? groups
        : groups
            ? [groups]
            : [];

    return groupList.map(group => ({

        name: getValue(group.NAME),

        parent: getValue(group.PARENT),

        guid: getValue(group.GROUPGUID),

        master_id: getValue(group.GROUPMASTERID),

        alter_id: getValue(group.GROUPALTERID),

        reserved_name: getValue(group.RESERVEDNAME),

        raw: group

    }));

}

module.exports = {
    parseStockGroupResponse
};