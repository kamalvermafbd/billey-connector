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

function parseGodownResponse(xml) {

    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "",
        parseTagValue: true,
        trimValues: true
    });

    const json = parser.parse(xml);

    const godowns =
        json?.ENVELOPE?.BODY?.DATA?.COLLECTION?.GODOWN || [];

    const godownList = Array.isArray(godowns)
        ? godowns
        : godowns
            ? [godowns]
            : [];

    return godownList.map(godown => ({

        name: getValue(godown.NAME),

        parent: getValue(godown.PARENT),

        raw: godown

    }));

}

module.exports = {
    parseGodownResponse
};