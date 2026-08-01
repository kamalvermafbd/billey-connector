const { XMLParser } = require("fast-xml-parser");


function getValue(node) {

    if (node == null) return "";

    if (typeof node === "string")
        return node.trim();

    if (typeof node === "number")
        return node;

    if (
        typeof node === "object" &&
        "#text" in node
    )
        return String(node["#text"]).trim();

    return "";

}


function parseGroupGuidResponse(xml) {


    const parser = new XMLParser({

        ignoreAttributes:false,

        attributeNamePrefix:"",

        parseTagValue:true,

        trimValues:true

    });


    const json =
        parser.parse(xml);


    const groups =
        json?.ENVELOPE?.BODY?.DATA?.COLLECTION?.GROUP || [];


    const groupList =
        Array.isArray(groups)
        ? groups
        : [groups];


    return groupList.map(group => ({

        guid:
            getValue(group.GUID),

        masterId:
            getValue(group.MASTERID) || null,

        alterId:
            getValue(group.ALTERID) || null

    }));

}


module.exports = {

    parseGroupGuidResponse

};