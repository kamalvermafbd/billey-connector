const { XMLParser } = require("fast-xml-parser");


function getValue(node) {

    if (node == null)
        return "";

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



function parseLedgerGuidResponse(xml) {


    const parser = new XMLParser({

        ignoreAttributes:false,

        attributeNamePrefix:"",

        parseTagValue:true,

        trimValues:true

    });


    const json =
        parser.parse(xml);



    const ledgers =
        json?.ENVELOPE?.BODY?.DATA?.COLLECTION?.LEDGER || [];



    const ledgerList =
        Array.isArray(ledgers)
        ? ledgers
        : [ledgers];



    return ledgerList.map(ledger => ({

        guid:
            getValue(ledger.GUID),


        masterId:
            getValue(ledger.MASTERID) || null,


        alterId:
            getValue(ledger.ALTERID) || null


    }));

}



module.exports = {

    parseLedgerGuidResponse

};