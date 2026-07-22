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

function first(item) {
    if (!item) return null;
    return Array.isArray(item) ? item[0] : item;
}

function formatDate(value) {
    if (!value) return "";

    const s = String(value);

    if (s.length !== 8) return s;

    return `${s.substring(0,4)}-${s.substring(4,6)}-${s.substring(6,8)}`;
}

function parseStockResponse(xml) {

    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "",
        parseTagValue: true,
        trimValues: true
    });

    const json = parser.parse(xml);

    const stocks =
        json?.ENVELOPE?.BODY?.DATA?.COLLECTION?.STOCKITEM || [];

const stockList = Array.isArray(stocks)
    ? stocks
    : stocks
        ? [stocks]
        : [];

return stockList.map(stock => {

    const hsnDetails = first(stock["HSNDETAILS.LIST"]);
    const gstDetails = first(stock["GSTDETAILS.LIST"]);

    const state = first(gstDetails?.["STATEWISEDETAILS.LIST"]);
    const rates = state?.["RATEDETAILS.LIST"] || [];

    const taxability = getValue(gstDetails?.TAXABILITY);

    const hsnCode = getValue(hsnDetails?.HSNCODE);

    const applicableFrom = formatDate(getValue(hsnDetails?.APPLICABLEFROM));
    const stateName = getValue(state?.STATENAME);


    let cgst = "";
    let sgst = "";
    let igst = "";
    let gstRate = "";

  const rateList = Array.isArray(rates)
    ? rates
    : rates
        ? [rates]
        : [];

    for (const r of rateList) {

        const head = getValue(r?.GSTRATEDUTYHEAD);
        const rate = getValue(r?.GSTRATE);

      if (head === "CGST")
    cgst = rate;

    else if (head === "SGST" || head === "SGST/UTGST")
        sgst = rate;

    else if (head === "IGST")
        igst = rate;
        gstRate = igst;
    }

    return {

    name: getValue(stock.NAME),

    parent: getValue(stock.PARENT),

    baseUnit: getValue(stock.BASEUNITS),

    gstApplicable: getValue(stock.GSTAPPLICABLE),

    typeOfSupply: getValue(stock.GSTTYPEOFSUPPLY),

    guid: getValue(stock.STOCKGUID),

 masterId: getValue(stock.STOCKMASTERID),
alterId: getValue(stock.STOCKALTERID),

    taxability,

    stateName,

    applicableFrom,

    hsnCode,

    cgst,

    sgst,

    igst,

    gstRate,

    raw: stock

};

});

}

module.exports = {
    parseStockResponse
};