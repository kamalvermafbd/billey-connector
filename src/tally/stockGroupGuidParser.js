const { XMLParser } = require("fast-xml-parser");


function getValue(node) {

    if (node == null)
        return "";


    if (typeof node === "string")
        return node.trim();


    if (typeof node === "number")
        return String(node);


    if (
        typeof node === "object" &&
        "#text" in node
    ) {

        return String(
            node["#text"]
        ).trim();

    }


    return "";

}



function parseStockGroupGuidResponse(xml) {


    const parser = new XMLParser({

        ignoreAttributes:false,

        parseTagValue:true,

        trimValues:true

    });


    const json =
        parser.parse(xml);



    const groups =
        json?.ENVELOPE?.BODY?.DATA?.COLLECTION?.STOCKGROUP
        ||
        json?.ENVELOPE?.BODY?.DATA?.COLLECTION?.STOCKGROUPS
        ||
        [];



    const groupList =
        Array.isArray(groups)
        ? groups
        : [groups];



    return groupList.map(group => ({

        guid:
            getValue(
                group.GROUPGUID ||
                group.GUID
            ),


        masterId:
            getValue(
                group.GROUPMASTERID ||
                group.MASTERID
            ),


        alterId:
            getValue(
                group.GROUPALTERID ||
                group.ALTERID
            )

    }));

}



module.exports = {

    parseStockGroupGuidResponse

};