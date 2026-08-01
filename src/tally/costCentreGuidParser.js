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


function parseCostCentreGuidResponse(xml){

    const parser = new XMLParser({
        ignoreAttributes:false,
        parseTagValue:true,
        trimValues:true
    });

    const json = parser.parse(xml);

    const centres =
        json?.ENVELOPE?.BODY?.DATA?.COLLECTION?.COSTCENTRE || [];

    const list =
        Array.isArray(centres)
        ? centres
        : [centres];


    return list.map(cc => ({

        guid:
            getValue(cc.GUID),

        masterId:
            getValue(cc.MASTERID),

        alterId:
            getValue(cc.ALTERID)

    }));

}


module.exports = {
    parseCostCentreGuidResponse
};
