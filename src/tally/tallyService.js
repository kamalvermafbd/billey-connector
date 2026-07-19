const axios = require("axios");

const {

  XMLParser

} = require(
  "fast-xml-parser"
);

const fs = require("fs");

const path = require("path");

const DEBUG_FILE = path.join(
  __dirname,
  "tally-debug.log"
);

const ledgerTemplate =
  require("./ledger-template");

const saleTemplate =
  require("./sale-template");

const stockTemplate =
  require("./stock-template");

  const salesLedgerTemplate =
require("./sales-ledger-template");

const {

    getSalesGL,

    getTaxGL,

    getDebtors,

    getRoundOffGL

} = require("./ledgerClassifier");

const TALLY_URL = "http://localhost:9000";

const parser =
  new XMLParser({

    ignoreAttributes: false,

    attributeNamePrefix: "",

    parseTagValue: true,

    trimValues: true

  });

function toArray(value) {

  if (!value) {

    return [];

  }

  return Array.isArray(value)

    ? value

    : [value];

}

function getValue(v) {

    if (v == null) return "";

    if (typeof v === "string") return v;

    if (typeof v === "number") return v;

    if (typeof v === "object") {

        if ("#text" in v) return v["#text"];

        if ("TEXT" in v) return v.TEXT;

    }

    return "";

}

// =========================
// BUILD GROUP TREE
// =========================

function buildGroupTree(groups) {

  const tree = {};

groups.forEach(group => {

    tree[group.name] = group.parent;

});

return tree;

}

function getNumber(v) {

    const value = Number(getValue(v));

    return isNaN(value) ? 0 : value;

}

function getDate(v) {

    const value = String(getValue(v));

    if (value.length !== 8) return value;

    return `${value.substring(0,4)}-${value.substring(4,6)}-${value.substring(6,8)}`;

}

function splitQuantity(value) {

    value = getValue(value);

    if (!value) {

        return {

            qty: 0,

            unit: ""

        };

    }

    const parts = value.trim().split(/\s+/);

    return {

        qty: Number(parts[0]) || 0,

        unit: parts.slice(1).join(" ")

    };

}

async function sendToTally(xml) {

  try {

    // Har API call pe purani log clear
    //fs.writeFileSync(DEBUG_FILE, "");

    // XML save
   // fs.appendFileSync(
 //     DEBUG_FILE,
  //    "\n========== XML SENT ==========\n\n" +
 //     xml +
  //    "\n\n"
 //   );

    const response = await axios.post(
      TALLY_URL,
      xml,
      {
        headers: {
          "Content-Type": "application/xml"
        }
      }
    );

    // Tally response save
 //   fs.appendFileSync(
 //     DEBUG_FILE,
  //    "\n========== TALLY RESPONSE ==========\n\n" +
 //     response.data +
 //     "\n"
  //  );

    return response.data;

  } catch (err) {

 //   fs.appendFileSync(
  //    DEBUG_FILE,
  //    "\n========== ERROR ==========\n\n" +
  //    (err.response?.data || err.message) +
 //     "\n"
 //   );

    throw err;

  }

}

async function getTallyCompanies() {

  const xml = `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>List of Companies</ID>
  </HEADER>

  <BODY>

    <DESC>

      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>

    </DESC>

  </BODY>

</ENVELOPE>
`;

 const result = await sendToTally(xml);



// Company names extract
const companies = [];

const regex = /<COMPANY\s+NAME="([^"]+)"/g;

let match;

while ((match = regex.exec(result)) !== null) {

  companies.push({
    name: match[1]
  });

}

return {
  success: true,
  companies
};

}

// =========================
// SELECT TALLY COMPANY
// =========================

async function selectCompany(
  companyName
) {

  const xml = `
<ENVELOPE>

  <HEADER>

    <TALLYREQUEST>
      Export
    </TALLYREQUEST>

  </HEADER>

  <BODY>

    <DESC>

      <STATICVARIABLES>

        <SVCURRENTCOMPANY>
          ${companyName}
        </SVCURRENTCOMPANY>

        <SVEXPORTFORMAT>
          $$SysName:XML
        </SVEXPORTFORMAT>

      </STATICVARIABLES>

      <REPORTNAME>
        List of Accounts
      </REPORTNAME>

    </DESC>

  </BODY>

</ENVELOPE>
`;

  return await sendToTally(xml);

}

// =========================
// GET GROUP MASTERS
// =========================

async function getGroups(company) {

    await selectCompany(company);

    const xml = `
<ENVELOPE>

    <HEADER>

        <VERSION>1</VERSION>

        <TALLYREQUEST>Export</TALLYREQUEST>

        <TYPE>Collection</TYPE>

        <ID>BilleyGroupCollection</ID>

    </HEADER>

    <BODY>

        <DESC>

            <STATICVARIABLES>

                <SVCURRENTCOMPANY>${company}</SVCURRENTCOMPANY>

                <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>

            </STATICVARIABLES>

            <TDL>

                <TDLMESSAGE>

                    <COLLECTION NAME="BilleyGroupCollection">

                        <TYPE>Group</TYPE>

                       <FETCH>

    Name,
    Parent,
    GUID,
    MASTERID,
    ALTERID,
    RESERVEDNAME,
    GSTREGISTRATIONTYPE,
    GSTIN,
    ADDRESS,
    STATE,
    COUNTRY,
    PINCODE,
    LEDGERPHONE,
    EMAIL,
    CONTACTPERSON,
    ISBILLWISEON

</FETCH>

                    </COLLECTION>

                </TDLMESSAGE>

            </TDL>

        </DESC>

    </BODY>

</ENVELOPE>
`;

    const result = await sendToTally(xml);

    fs.writeFileSync(
    path.join(__dirname, "groups.xml"),
    result,
    "utf8"
);

const json = parser.parse(result);

   const groupsRaw =
    json?.ENVELOPE?.BODY?.DATA?.COLLECTION?.GROUP;

const groups =
    Array.isArray(groupsRaw)
        ? groupsRaw
        : groupsRaw
        ? [groupsRaw]
        : [];

return groups.map(group => ({

    name: group.NAME,

    parent: getValue(group.PARENT),

    reservedName: group.RESERVEDNAME || ""

}));
    

}


// =========================
// GET ROOT GROUP
// =========================

function getRootGroup(groupName, groupTree) {

  let current = groupName;

while (
    groupTree[current] &&
    groupTree[current] !== "Primary" &&
    groupTree[current] !== " Primary"
) {

    current = groupTree[current];

}

return current;

}


// =========================
// GET ALL LEDGERS
// =========================

async function getAllLedgers(
  company,
  groupTree
) {

  // Company select (future compatibility)
  await selectCompany(
    company
  );

  const xml = `
<ENVELOPE>

  <HEADER>

    <VERSION>1</VERSION>

    <TALLYREQUEST>Export</TALLYREQUEST>

    <TYPE>Collection</TYPE>

   <ID>BilleyLedgerCollection</ID>

  </HEADER>

  <BODY>

    <DESC>

      <STATICVARIABLES>

        <SVCURRENTCOMPANY>
          ${company}
        </SVCURRENTCOMPANY>

        <SVEXPORTFORMAT>
          $$SysName:XML
        </SVEXPORTFORMAT>

      </STATICVARIABLES>

      <TDL>

    <TDLMESSAGE>

        <COLLECTION NAME="BilleyLedgerCollection">

            <TYPE>Ledger</TYPE>

            <FETCH>

                Name,
                Parent

            </FETCH>

        </COLLECTION>

    </TDLMESSAGE>

</TDL>

    </DESC>

  </BODY>

</ENVELOPE>
`;

  const result = await sendToTally(xml);

  fs.writeFileSync(
    path.join(__dirname, "ledgers.xml"),
    result,
    "utf8"
);

const json = parser.parse(result);

const ledgersRaw =
    json?.ENVELOPE?.BODY?.DATA?.COLLECTION?.LEDGER;

const ledgers =
    Array.isArray(ledgersRaw)
        ? ledgersRaw
        : ledgersRaw
        ? [ledgersRaw]
        : [];

const ledgerList = ledgers.map(ledger => ({

    name: ledger.NAME,

    parent: getValue(ledger.PARENT),

    rootGroup: getRootGroup(
        getValue(ledger.PARENT),
        groupTree
    )

}));
 

  console.log(
    "TALLY LEDGERS",
    ledgerList
  );

 
return ledgerList;

}

// =========================
// GET STOCK ITEMS
// =========================

async function getStockItems(
  company
) {

  const xml = `
<ENVELOPE>

  <HEADER>

    <VERSION>1</VERSION>

    <TALLYREQUEST>Export</TALLYREQUEST>

    <TYPE>Collection</TYPE>

    <ID>BilleyStockCollection</ID>

  </HEADER>

  <BODY>

    <DESC>

      <STATICVARIABLES>

        <SVCURRENTCOMPANY>
          ${company}
        </SVCURRENTCOMPANY>

        <SVEXPORTFORMAT>
          $$SysName:XML
        </SVEXPORTFORMAT>

      </STATICVARIABLES>

      <TDL>

        <TDLMESSAGE>

          <COLLECTION NAME="BilleyStockCollection">

            <TYPE>Stock Item</TYPE>

            <FETCH>
                Name,
                Parent,
                BaseUnits,
                GSTHSNName,
                HSNCode
              </FETCH>

          </COLLECTION>

        </TDLMESSAGE>

      </TDL>

    </DESC>

  </BODY>

</ENVELOPE>
`;



 const result =
  await sendToTally(xml);

// =========================
// XML TO JSON
// =========================

const json =
  parser.parse(result);


return json;

}

async function getUnits(company) {

  await selectCompany(company);

  const xml = `
<ENVELOPE>

  <HEADER>

    <VERSION>1</VERSION>

    <TALLYREQUEST>Export</TALLYREQUEST>

    <TYPE>Data</TYPE>

    <ID>List of Accounts</ID>

  </HEADER>

  <BODY>

    <DESC>

      <STATICVARIABLES>

        <SVCURRENTCOMPANY>${company}</SVCURRENTCOMPANY>

        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>

        <ACCOUNTTYPE>Units</ACCOUNTTYPE>

      </STATICVARIABLES>

    </DESC>

  </BODY>

</ENVELOPE>
`;

  const result = await sendToTally(xml);

  const json = parser.parse(result);

  return json;
}


async function getSalesVouchers(company) {
   await selectCompany(company);
const xml = `
<ENVELOPE>

    <HEADER>

        <VERSION>1</VERSION>

        <TALLYREQUEST>Export</TALLYREQUEST>

        <TYPE>Collection</TYPE>

        <ID>BilleySalesCollection</ID>

    </HEADER>

    <BODY>

        <DESC>

            <STATICVARIABLES>

                <SVCURRENTCOMPANY>${company}</SVCURRENTCOMPANY>

                <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>

            </STATICVARIABLES>

            <TDL>

    <TDLMESSAGE>

        <COLLECTION NAME="BilleySalesCollection">

            <TYPE>Voucher</TYPE>

            <CHILDOF>Sales</CHILDOF>

           <FETCH>
    Date,
    VoucherNumber,
    PartyLedgerName,
    Narration,
    AllInventoryEntries,
    LedgerEntries,
    PartyGSTIN,
    PlaceOfSupply,
    BasicBuyerName,
    BasicBuyerAddress,
    GSTRegistrationType,
    PersistedView,
    VoucherTypeName
</FETCH>

        </COLLECTION>

    </TDLMESSAGE>

</TDL>

        </DESC>

    </BODY>

</ENVELOPE>
`;

const result = await sendToTally(xml);
const fs = require("fs");
const path = require("path");

const outputFile = path.join(
    __dirname,
    "sales-vouchers.xml"
);

fs.writeFileSync(outputFile, result, "utf8");

console.log(
    "✅ Sales vouchers saved to:",
    outputFile
);

const json = parser.parse(result);

return json;

}


// =========================
// GET TALLY MAPPING DATA
// =========================

async function getTallyMappingData(company) {
  console.log("COMPANY RECEIVED:", company);

const groups =
    await getGroups(company);

console.log(
    JSON.stringify(groups, null, 2)
);

const groupTree =
    buildGroupTree(groups);

const salesJson =
    await getSalesVouchers(company);

const vouchers =
    toArray(
        salesJson?.ENVELOPE?.BODY?.DATA?.COLLECTION?.VOUCHER
    );

    console.log(
    "TOTAL VOUCHERS:",
    vouchers.length
);
const sales = vouchers.map(normalizeVoucher);
console.log(JSON.stringify(sales[0], null, 2));
  // =========================
  // GET SALES LEDGERS
  // =========================

const allLedgers =
    await getAllLedgers(
        company,
        groupTree
    );

console.log(
    "ALL LEDGERS",
    allLedgers
);

const ledgerData = {

    salesGL: getSalesGL(allLedgers),

    taxGL: getTaxGL(allLedgers),

    roundOffGL: getRoundOffGL(allLedgers),

    debtors: getDebtors(allLedgers)

};

console.log(
    "LEDGER DATA",
    ledgerData
);

  // =========================
  // GET STOCK ITEMS
  // =========================

  const stockJson =
    await getStockItems(company);

  const stockRaw =
    stockJson?.ENVELOPE?.BODY?.DATA?.COLLECTION?.STOCKITEM;

  const stock =
    Array.isArray(stockRaw)
      ? stockRaw
      : stockRaw
      ? [stockRaw]
      : [];

  const stockList = stock.map((item) => ({
    name: item.NAME,
    unit:
      typeof item.BASEUNITS === "object"
        ? item.BASEUNITS["#text"]
        : item.BASEUNITS || ""
  }));

  // =========================
  // GET UNITS
  // =========================

  const unitJson =
    await getUnits(company);

  const unitRaw =
    unitJson?.ENVELOPE?.BODY?.DATA?.TALLYMESSAGE;

  const units =
    Array.isArray(unitRaw)
      ? unitRaw
      : unitRaw
      ? [unitRaw]
      : [];

  const unitList =
    units
      .filter(x => x.UNIT)
      .map(x => ({
        name: x.UNIT.NAME
      }));

  // =========================
  // FINAL RESPONSE
  // =========================

  return {

    success: true,

    data: {

      salesGL: ledgerData.salesGL,

      taxGL: ledgerData.taxGL,

      roundOffGL: ledgerData.roundOffGL,

      units: unitList,

      stock: stockList,
      sales,

      hsn: [],

      debtors: ledgerData.debtors

    }

  };

}

function normalizeVoucher(v) {

    return {

        voucherNumber: getNumber(v.VOUCHERNUMBER),

        date: getDate(v.DATE),

        party: getValue(v.PARTYLEDGERNAME),

        gstin: getValue(v.PARTYGSTIN),

        gstRegistrationType: getValue(v.GSTREGISTRATIONTYPE),

        placeOfSupply: getValue(v.PLACEOFSUPPLY),

        buyerName: getValue(v.BASICBUYERNAME),

        narration: getValue(v.NARRATION),

        items: parseItems(v),

        ledgers: parseLedgers(v),

        taxes: parseTaxes(v)

    };

}

function parseItems(v) {

    return toArray(v["ALLINVENTORYENTRIES.LIST"]).map(item => {

        const qty = splitQuantity(item.ACTUALQTY);

        const billed = splitQuantity(item.BILLEDQTY);

        const rate = splitQuantity(item.RATE);

        return {

            stockItem: getValue(item.STOCKITEMNAME),

            hsn: String(getValue(item.GSTHSNNAME)),

            qty: qty.qty,

            qtyUnit: qty.unit,

            billedQty: billed.qty,

            billedQtyUnit: billed.unit,

            rate: rate.qty,

            rateUnit: rate.unit,

            amount: getNumber(item.AMOUNT)

        };

    });

}

function parseLedgers(v) {

    const ledgers = toArray(v["LEDGERENTRIES.LIST"]);

    return ledgers.map(l => ({

        ledger: l.LEDGERNAME,

        amount: Number(l.AMOUNT)

    }));

}

function parseTaxes(v) {

    const taxes = {
        cgst: 0,
        sgst: 0,
        igst: 0
    };

    toArray(v["ALLINVENTORYENTRIES.LIST"]).forEach(item => {

        toArray(item["RATEDETAILS.LIST"]).forEach(rate => {

            switch (rate.GSTRATEDUTYHEAD) {

                case "CGST":
                    taxes.cgst = Number(rate.GSTRATE);
                    break;

                case "SGST/UTGST":
                    taxes.sgst = Number(rate.GSTRATE);
                    break;

                case "IGST":
                    taxes.igst = Number(rate.GSTRATE);
                    break;

            }

        });

    });

    return taxes;

}


async function createStockItem({

  company,

  stockName,

  unit,

  hsn,

  gstRate

}) {

  const xml = stockTemplate({

    company,

    stockName,

    unit,

    hsn,

    gstRate

  });

  // =========================
  // DEBUG XML
  // =========================

  fs.writeFileSync(

    path.join(
      __dirname,
      "stock-debug.log"
    ),

    "========== XML ==========\n\n" +

    xml +

    "\n\n"

  );

  // =========================
  // RETURN XML
  // =========================

  return xml;

}
async function createSalesLedger({

  company,

  ledgerName,

}) {

  const xml = salesLedgerTemplate({

    company,

    ledgerName,

  });

  // =========================
  // DEBUG XML
  // =========================

  fs.writeFileSync(

    path.join(
      __dirname,
      "sales-ledger-debug.log"
    ),

    "========== XML ==========\n\n" +

    xml +

    "\n\n"

  );

  // =========================
  // RETURN XML
  // =========================

  return xml;

}

// =========================
// CREATE UNIT XML
// =========================

function createUnit({

  company,

  unitName,

  uqcCode,

}) {

  console.log(
    "CREATE UNIT PARAMS",
    {
      company,
      unitName,
      uqcCode,
    }
  );

  return `

<ENVELOPE>

<HEADER>

<TALLYREQUEST>Import Data</TALLYREQUEST>

</HEADER>

<BODY>

<IMPORTDATA>

<REQUESTDESC>

<REPORTNAME>All Masters</REPORTNAME>

<STATICVARIABLES>

<SVCURRENTCOMPANY>${company}</SVCURRENTCOMPANY>
<SVIMPORTMODE>Alter</SVIMPORTMODE>


</STATICVARIABLES>

</REQUESTDESC>

<REQUESTDATA>

<TALLYMESSAGE xmlns:UDF="TallyUDF">

<UNIT NAME="${unitName}" RESERVEDNAME="">

<NAME>${unitName}</NAME>


<ISUPDATINGTARGETID>No</ISUPDATINGTARGETID>

<ISDELETED>No</ISDELETED>

<ISSECURITYONWHENENTERED>No</ISSECURITYONWHENENTERED>

<ASORIGINAL>Yes</ASORIGINAL>

<ISGSTEXCLUDED>No</ISGSTEXCLUDED>

<ISSIMPLEUNIT>Yes</ISSIMPLEUNIT>

<REPORTINGUQCDETAILS.LIST>

<APPLICABLEFROM>20260401</APPLICABLEFROM>

<REPORTINGUQCNAME>${uqcCode}</REPORTINGUQCNAME>

</REPORTINGUQCDETAILS.LIST>

</UNIT>

</TALLYMESSAGE>

</REQUESTDATA>

</IMPORTDATA>

</BODY>

</ENVELOPE>

`;

}

async function createLedger({
    company,

  name,

  gstin = "",

  mobile = "",

  address = "",

  state = "",

  pincode = "",

  email = "",

  contactPerson = "",

creditPeriod = 0,

openingBalance = 0,

gstRegistered = false,

country = "India",

  parent = "Sundry Debtors",

  billWise = true

}) {

  const xml = ledgerTemplate({

  company,

  name,

  gstin,

  mobile,

  address,

  state,

  pincode,

  email,

  contactPerson,

  country,

  creditPeriod,

  openingBalance,

  gstRegistered,

  parent,

  billWise

});

  return await sendToTally(xml);

}


async function createSale({

  company,

  voucherDate,

  voucherNumber,

  partyName,

  billingAddress,

  state,

shippingState,

  country,

  gstRegistrationType,

partyGstin,

billingStateCode,

placeOfSupply,

buyerName,

shippingAddress,

billingPincode,

shippingPincode,

shippingStateCode,

  items,

  invoiceAmount,

  cgst,

  sgst,

  igst,

 roundOff,

roundOffIsNegative,

cgstLedger,

  sgstLedger,

  igstLedger,

  roundOffLedger,

  transporterName,

vehicleNo,

grRRNo,

ewayBillNo,

dispatchDate,

lrDate,

ewayDate,

creditPeriod,

  salesLedger

}) {

  const xml = saleTemplate({

  company,

  voucherDate,

  voucherNumber,

  partyName,

  billingAddress,

  state,
shippingState,

  country,

  gstRegistrationType,

partyGstin,

billingStateCode,

placeOfSupply,

buyerName,

shippingAddress,

billingPincode,

shippingPincode,

shippingStateCode,

  items,

  invoiceAmount,

  cgst,

  sgst,

  igst,

  roundOff,

  roundOffIsNegative,

  cgstLedger,

  sgstLedger,

  igstLedger,

  roundOffLedger,

  transporterName,

vehicleNo,

grRRNo,

ewayBillNo,

dispatchDate,

lrDate,

ewayDate,

creditPeriod,

  salesLedger

});

  return await sendToTally(xml);

}

module.exports = {

  sendToTally,

  createUnit,

  createStockItem,

    createSalesLedger,

  createLedger,

  createSale,

  getTallyCompanies,

  selectCompany,
  
  getAllLedgers,

  getStockItems,

  getTallyMappingData,

  getUnits,

  getSalesVouchers,

  getGroups,

  //getStockMasters

};