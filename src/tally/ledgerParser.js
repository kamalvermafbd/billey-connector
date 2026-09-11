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

function calculateDueDate(billDate, creditPeriod) {

    const dateText = String(billDate || "").trim();
    const periodText = String(creditPeriod || "").trim();

    if (!dateText || !periodText) return null;

    const year = Number(dateText.slice(0, 4));
    const month = Number(dateText.slice(4, 6));
    const day = Number(dateText.slice(6, 8));

    if (!year || !month || !day) return null;

    const date = new Date(Date.UTC(year, month - 1, day));

    const match = periodText.match(
        /^(\d+)\s*(Day|Days|Month|Months|Year|Years)$/i
    );

    if (!match) return null;

    const value = Number(match[1]);
    const unit = match[2].toLowerCase();

    if (unit === "day" || unit === "days") {
        date.setUTCDate(date.getUTCDate() + value);
    }

    if (unit === "month" || unit === "months") {
        date.setUTCMonth(date.getUTCMonth() + value);
    }

    if (unit === "year" || unit === "years") {
        date.setUTCFullYear(date.getUTCFullYear() + value);
    }

    return date.toISOString().slice(0, 10);
}

function parseLedgerResponse(xml) {

    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "",
        parseTagValue: true,
        trimValues: true
    });

    const json = parser.parse(xml);

    const ledgers =
        json?.ENVELOPE?.BODY?.DATA?.COLLECTION?.LEDGER || [];

const ledgerList = Array.isArray(ledgers)
    ? ledgers
    : [ledgers];

const sudhir = ledgerList.find(
    x => getValue(x.NAME) === "Sudhir Traders"
);

if (sudhir) {

console.log("================================");
console.log("SUDHIR TRADERS RAW XML");
console.log("NAME :", getValue(sudhir.NAME));
console.log("OPENINGBALANCE RAW :", JSON.stringify(sudhir.OPENINGBALANCE, null, 2));
console.log("OPENINGBALANCEON RAW :", JSON.stringify(sudhir.OPENINGBALANCEON, null, 2));
console.log("LEDGER KEYS :", Object.keys(sudhir));

console.log(
    "ORIGINALOPENINGBALANCE RAW :",
    JSON.stringify(sudhir.ORIGINALOPENINGBALANCE, null, 2)
);

console.log("ALTERID :", getValue(sudhir.ALTERID));
console.log("================================");

}

return ledgerList.map(ledger => {

    const gstDetails = Array.isArray(ledger["LEDGSTREGDETAILS.LIST"])
        ? ledger["LEDGSTREGDETAILS.LIST"][ledger["LEDGSTREGDETAILS.LIST"].length - 1]
        : ledger["LEDGSTREGDETAILS.LIST"];

    const mailingDetails = Array.isArray(ledger["LEDMAILINGDETAILS.LIST"])
        ? ledger["LEDMAILINGDETAILS.LIST"][ledger["LEDMAILINGDETAILS.LIST"].length - 1]
        : ledger["LEDMAILINGDETAILS.LIST"];

        const contactDetails = Array.isArray(ledger["CONTACTDETAILS.LIST"])
    ? ledger["CONTACTDETAILS.LIST"][0]
    : ledger["CONTACTDETAILS.LIST"];

    if (getValue(ledger.PARENT) === "Duties & Taxes") {

    console.log("================================");

    console.log(getValue(ledger.NAME));

    console.log("TYPEOFDUTYTAX :", ledger.TYPEOFDUTYTAX);

    console.log(JSON.stringify(ledger, null, 2));
    
    console.log("TAXTYPE :", ledger.TAXTYPE);

console.log("GSTDUTYHEAD :", ledger.GSTDUTYHEAD);

console.log(
    "RATEOFTAXCALCULATION :",
    ledger.RATEOFTAXCALCULATION
);

console.log("GSTRATE :", ledger.GSTRATE);


    console.log("================================");

}

global.parentDebug ??= [];

global.parentDebug.push({
    ledger: getValue(ledger.NAME),
    parent: getValue(ledger.PARENT),
    parentGuid: getValue(ledger.PARENTGUID),
    parentMasterId: getValue(ledger.PARENTMASTERID),
    parentAlterId: getValue(ledger.PARENTALTERID)
});

    const openingBalance = Number(getValue(ledger.OPENINGBALANCE) || 0);

    const billAllocations =
    Array.isArray(ledger["BILLALLOCATIONS.LIST"])
        ? ledger["BILLALLOCATIONS.LIST"]
        : ledger["BILLALLOCATIONS.LIST"]
            ? [ledger["BILLALLOCATIONS.LIST"]]
            : [];

const openingBillAllocations =
    billAllocations
        .map(bill => ({
            billName: getValue(bill.NAME),
            billDate: getValue(bill.BILLDATE),
           // dueDate: getValue(bill.BILLCREDITPERIOD),
           dueDate: calculateDueDate(
                    getValue(bill.BILLDATE),
                    getValue(bill.BILLCREDITPERIOD)
                ),
            openingBalance: Number(
                getValue(bill.OPENINGBALANCE) || 0
            )
        }))
        .filter(bill =>
            bill.billName &&
            bill.openingBalance !== 0
        );

    return {

    guid: getValue(ledger.GUID),

    masterId: getValue(ledger.MASTERID),

    alterId: getValue(ledger.ALTERID),

    name: getValue(ledger.NAME),

    parent: getValue(ledger.PARENT),

    parentGroupGuid: getValue(ledger.PARENTGUID),

parentGroupMasterId: getValue(ledger.PARENTMASTERID),

parentGroupAlterId: getValue(ledger.PARENTALTERID),


    reservedName: getValue(ledger.RESERVEDNAME),

    gstApplicable: getValue(ledger.GSTAPPLICABLE),

   gstRegistrationType: getValue(gstDetails?.GSTREGISTRATIONTYPE),

    gstin: getValue(gstDetails?.GSTIN),

    mailingName: getValue(
        mailingDetails?.MAILINGNAME || ledger.MAILINGNAME
    ),

address: Array.isArray(mailingDetails?.["ADDRESS.LIST"]?.ADDRESS)
    ? mailingDetails["ADDRESS.LIST"].ADDRESS.map(getValue).join(", ")
    : getValue(
        mailingDetails?.["ADDRESS.LIST"]?.ADDRESS ||
        ledger["ADDRESS.LIST"]?.ADDRESS
    ),

stateName: getValue(mailingDetails?.STATE),

country: getValue(mailingDetails?.COUNTRY),

pinCode: getValue(
    mailingDetails?.PINCODE || ledger.PINCODE
),

phone: getValue(
    ledger.LEDGERMOBILE ||
    contactDetails?.PHONENUMBER
),

   email: getValue(
    ledger.EMAIL ||
    contactDetails?.EMAIL
),

    contactPerson: getValue(
    ledger.CONTACTPERSON ||
    contactDetails?.NAME
),

   openingBalance,

openingBalanceAmount: Math.abs(openingBalance),

openingBalanceType:
    openingBalance < 0
        ? "DR"
        : openingBalance > 0
            ? "CR"
            : "",

            openingBillAllocations,
            
    isBillWise:
        String(getValue(ledger.ISBILLWISEON)).toUpperCase() === "YES",

    isRevenue:
        String(getValue(ledger.ISREVENUE)).toUpperCase() === "YES",

    isDeemedPositive:
        String(getValue(ledger.ISDEEMEDPOSITIVE)).toUpperCase() === "YES",

    isParty:
    !!(
        getValue(ledger.PARENT) &&
        getValue(ledger.PARENT) !== "Sales Accounts" &&
        getValue(ledger.PARENT) !== "Purchase Accounts" &&
        getValue(ledger.PARENT) !== "Duties & Taxes"
    ),

    gstDutyType: getValue(ledger.TAXTYPE),

    gstTaxType: getValue(ledger.GSTDUTYHEAD),

    gstRate: Number(
        getValue(ledger.RATEOFTAXCALCULATION) || 0
    ),

  raw: ledger

    };

});

}

module.exports = {
    parseLedgerResponse
};