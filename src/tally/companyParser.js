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

function parseCompanyResponse(xml) {

    const parser = new XMLParser({

        ignoreAttributes: false,
        attributeNamePrefix: "",
        parseTagValue: true,
        trimValues: true

    });

    const json = parser.parse(xml);

    const company =
        json?.ENVELOPE?.BODY?.DATA?.TALLYMESSAGE?.COMPANY;

    return {

        guid: getValue(company?.GUID),

        companyName: getValue(company?.NAME),

        booksBeginningFrom:
            getValue(company?.BOOKSFROM),

        financialYearBeginning:
            getValue(company?.FINANCIALYEARFROM),

        startingFrom:
            getValue(company?.STARTINGFROM),

        raw: company

    };

}

module.exports = {
    parseCompanyResponse
};