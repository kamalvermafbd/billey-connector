const { XMLParser } = require("fast-xml-parser");

function getValue(node){

    if(node == null) return "";

    if(typeof node === "string")
        return node.trim();

    if(typeof node === "number")
        return String(node);

    if(typeof node === "object" && "#text" in node)
        return String(node["#text"]).trim();

    return "";
}


function parseUnitGuidResponse(xml){

    const parser = new XMLParser({
        ignoreAttributes:false,
        parseTagValue:true,
        trimValues:true
    });

    const json = parser.parse(xml);


    const units =
        json?.ENVELOPE?.BODY?.DATA?.COLLECTION?.UNIT || [];


    const list =
        Array.isArray(units)
        ? units
        : [units];


    return list.map(unit => ({

        guid:
            getValue(unit.GUID || unit.UNITGUID),

        masterId:
            getValue(unit.MASTERID || unit.UNITMASTERID),

        alterId:
            getValue(unit.ALTERID || unit.UNITALTERID)

    }));

}


module.exports = {
    parseUnitGuidResponse
};
