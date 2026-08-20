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
 /*   fs.appendFileSync(
      DEBUG_FILE,
     "\n========== XML SENT ==========\n\n" +
      xml +
     "\n\n"
    );
    */
console.log("====================================");
console.log(">>> Tally request started");
console.trace("Called From");
console.log("====================================");


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
 /*   fs.appendFileSync(
      DEBUG_FILE,
      "\n========== TALLY RESPONSE ==========\n\n" +
      response.data +
      "\n"
    );
    */
console.log("<<< Tally response received");

    return response.data;

  } catch (err) {

    console.log(">>> Tally request failed");
console.error(err);

 //   fs.appendFileSync(
  //    DEBUG_FILE,
  //    "\n========== ERROR ==========\n\n" +
  //    (err.response?.data || err.message) +
 //     "\n"
 //   );

    throw err;

  }

}

// ============================================================
// LEVEL-1 TALLY CHUNKING
// MasterID Range Fetch
// NEW CODE - EXISTING FUNCTIONS UNTOUCHED
// ============================================================
async function fetchTallyCollectionByMasterId({
    company,
    collectionName,
    collectionType,
    startId,
    endId,
    fetchFields = []
}) {

    if (!company) {
        throw new Error(
            "company missing in fetchTallyCollectionByMasterId"
        );
    }

    if (!collectionName) {
        throw new Error(
            "collectionName missing in fetchTallyCollectionByMasterId"
        );
    }

    if (!collectionType) {
        throw new Error(
            "collectionType missing in fetchTallyCollectionByMasterId"
        );
    }

    if (
        !Number.isFinite(startId) ||
        !Number.isFinite(endId)
    ) {
        throw new Error(
            "startId/endId must be numbers"
        );
    }

    if (endId <= startId) {
        throw new Error(
            `Invalid MasterID range: ${startId} - ${endId}`
        );
    }

    // Same company selection used by getAllLedgers()
    await selectCompany(company);

    const fetchXml =
        fetchFields.length > 0
            ? `
        <FETCH>
            ${fetchFields.join(",\n")}
        </FETCH>
      `
            : "";

    const xml = `
<ENVELOPE>

    <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Export</TALLYREQUEST>
        <TYPE>Collection</TYPE>
        <ID>${collectionName}</ID>
    </HEADER>

    <BODY>

        <DESC>

            <STATICVARIABLES>

               <SVCURRENTCOMPANY>
    ${company}
</SVCURRENTCOMPANY>

<SVFROMDATE TYPE="Date">
      20160401
</SVFROMDATE>

<SVTODATE TYPE="Date">
    20991231
</SVTODATE>

<SVCURRENTDATE TYPE="Date">
    20991231
</SVCURRENTDATE>

<SVEXPORTFORMAT>
    $$SysName:XML
</SVEXPORTFORMAT>

            </STATICVARIABLES>

            <TDL>

                <TDLMESSAGE>

                    <COLLECTION NAME="${collectionName}">

                        <TYPE>${collectionType}</TYPE>

                        ${fetchXml}

                        <FILTER>
                            BilleyMasterIDRangeFilter
                        </FILTER>

                    </COLLECTION>

                   <SYSTEM TYPE="Formulae" NAME="BilleyMasterIDRangeFilter">
                    $MASTERID &gt; ${startId} AND $MASTERID &lt;= ${endId}
                </SYSTEM>

                </TDLMESSAGE>

            </TDL>

        </DESC>

    </BODY>

</ENVELOPE>
`;

    // ========================================================
    // SAVE GENERATED XML FOR DEBUGGING
    // ========================================================

    fs.writeFileSync(
        path.join(
            __dirname,
            "..",
            "logs",
            "master-id-request.xml"
        ),
        xml
    );

    const startedAt = Date.now();

    console.log(
        "===================================="
    );

    console.log(
        "TALLY MASTER ID RANGE TEST"
    );

    console.log(
        "Company :",
        company
    );

    console.log(
        "Collection :",
        collectionName
    );

    console.log(
        "Type :",
        collectionType
    );

    console.log(
        "MasterID Range :",
        `${startId} - ${endId}`
    );

    console.log(
        "FILTER : ENABLED"
    );

    console.log(
        "Request XML saved to:",
        "src/logs/master-id-request.xml"
    );

    const result =
        await sendToTally(xml);

    const durationMs =
        Date.now() - startedAt;

    const responseBytes =
        Buffer.byteLength(
            String(result || ""),
            "utf8"
        );

    console.log(
        "Response Bytes :",
        responseBytes
    );

    console.log(
        "Response KB :",
        Math.round(
            responseBytes / 1024
        )
    );

    console.log(
        "Duration MS :",
        durationMs
    );

    console.log(
        "===================================="
    );

    return result;
}

async function fetchMasterIds({
    company
}) {

    if (!company) {
        throw new Error(
            "company missing in fetchMasterIds"
        );
    }

    await selectCompany(company);

    const xml = `
<ENVELOPE>

    <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Export</TALLYREQUEST>
        <TYPE>Collection</TYPE>
        <ID>BilleyMasterIdCollection</ID>
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

                    <COLLECTION NAME="BilleyMasterIdCollection">

                        <TYPE>Group</TYPE>

                        <FETCH>
                            MASTERID
                        </FETCH>

                    </COLLECTION>

                </TDLMESSAGE>

            </TDL>

        </DESC>

    </BODY>

</ENVELOPE>
`;

    const response =
        await sendToTally(xml);

    const json =
        parser.parse(response);

    const rawMasters =
        json?.ENVELOPE?.BODY?.DATA?.COLLECTION?.GROUP;

    const masters =
        toArray(rawMasters);

    return masters
        .map(m =>
            Number(
                getValue(m.MASTERID)
            )
        )
        .filter(id =>
            Number.isFinite(id)
        );
}

async function fetchMasterIdsInBatches({
    company,
    batchSize = 50
}) {

    const masterIds =
        await fetchMasterIds({
            company
        });

    const batches = [];

    for (
        let i = 0;
        i < masterIds.length;
        i += batchSize
    ) {

        batches.push(
            masterIds.slice(
                i,
                i + batchSize
            )
        );
    }

    return batches;
}

async function fetchMastersInBatches({
    company,
    collectionName,
    collectionType,
    fetchFields = [],
    batchSize = 50
}) {

    const batches =
        await fetchMasterIdsInBatches({
            company,
            batchSize
        });

    const allResults = [];

    for (const batch of batches) {

        const result =
            await fetchTallyCollection({

                company,

                collectionName,

                collectionType,

                fetchFields,

                masterIds: batch
            });

        allResults.push(result);
    }

    return allResults;
}


async function fetchVouchersInBatches({
    company,
    fromDate,
    toDate,
    booksBeginningFrom,
    lastAlterId,
    syncMode,
    batchSize = 50
}) {

   const batches =
    await fetchVoucherIdsInBatches({
        company,
        fromDate,
        toDate,
        booksBeginningFrom,
        lastAlterId,
        syncMode,
        batchSize
    });

        const collectionFromDate =
    syncMode === "ALTERID"
        ? "20160401"
        : fromDate;

const collectionToDate =
    syncMode === "ALTERID"
        ? "20991231"
        : toDate;

    
    const allResults = [];

    for (const batch of batches) {

        const masterIds =
            batch
                .map(row => row.masterid)
                .filter(
                    id => Number.isFinite(
                        Number(id)
                    )
                )
                .map(id => Number(id));

        if (!masterIds.length) {
            continue;
        }

        const result =
            await fetchTallyCollection({

                company,

                collectionName:
                    "BilleyVoucherCollection",

                collectionType:
                    "Voucher",

                fetchFields: [
                    "GUID",
                    "MASTERID",
                    "ALTERID",
                    "DATE",
                    "EFFECTIVEDATE",
                    "VOUCHERTYPENAME",
                    "VOUCHERNUMBER",
                    "REFERENCE",
                    "REFERENCEDATE",
                    "PARTYLEDGERNAME",
                    "NARRATION",
                    "ISINVOICE",
                    "ISOPTIONAL",
                    "ISCANCELLED"
                ],

                masterIds,

                fromDate: collectionFromDate,
                toDate: collectionToDate
            });

        allResults.push(result);
    }

    return allResults;
}
/*
async function fetchVoucherIds({
    company,
    fromDate,
    toDate,
    startMasterId = null,
    endMasterId = null
}) {

    if (!company) {
        throw new Error(
            "company missing in fetchVoucherIds"
        );
    }

    if (!fromDate) {
        throw new Error(
            "fromDate missing in fetchVoucherIds"
        );
    }

    if (!toDate) {
        throw new Error(
            "toDate missing in fetchVoucherIds"
        );
    }

    await selectCompany(company);

    const useMasterIdRange =
        startMasterId !== null &&
        endMasterId !== null;

    const xml = `
<ENVELOPE>

    <HEADER>

        <VERSION>1</VERSION>

        <TALLYREQUEST>Export</TALLYREQUEST>

        <TYPE>Collection</TYPE>

        <ID>BilleyVoucherIdCollection</ID>

    </HEADER>

    <BODY>

        <DESC>

            <STATICVARIABLES>

                <SVCURRENTCOMPANY>
                    ${company}
                </SVCURRENTCOMPANY>

                <SVFROMDATE TYPE="Date">
                    19000101
                </SVFROMDATE>

                <SVTODATE TYPE="Date">
                    20991231
                </SVTODATE>

                <SVCURRENTDATE TYPE="Date">
                    20991231
                </SVCURRENTDATE>

                <SVEXPORTFORMAT>
                    $$SysName:XML
                </SVEXPORTFORMAT>

            </STATICVARIABLES>

            <TDL>

                <TDLMESSAGE>

                <COLLECTION NAME="BilleyVoucherIdCollection">

    <TYPE>Voucher</TYPE>

    <FILTER>
        BilleyVoucherSyncFilter
    </FILTER>

    <FETCH>

        MASTERID,
        GUID,
        ALTERID,
        DATE,
        VOUCHERTYPENAME,
        VOUCHERNUMBER

    </FETCH>

</COLLECTION>


<SYSTEM
    TYPE="Formulae"
    NAME="BilleyVoucherSyncFilter">

    $DATE >= ${Number(fromDate)}
    AND
    $DATE <= ${Number(toDate)}

    ${
        useMasterIdRange
            ? `
            AND
            $MASTERID > ${Number(startMasterId)}
            AND
            $MASTERID <= ${Number(endMasterId)}
            `
            : ""
    }

</SYSTEM>

                </TDLMESSAGE>

            </TDL>

        </DESC>

    </BODY>

</ENVELOPE>
`;

    console.log(
        "======================================"
    );

    console.log(
        "VOUCHER DISCOVERY REQUEST"
    );

    console.log(
        "Company:",
        company
    );

    console.log(
        "Date:",
        fromDate,
        "→",
        toDate
    );

    if (useMasterIdRange) {

        console.log(
            "MASTERID RANGE:",
            startMasterId,
            "→",
            endMasterId
        );

    } else {

        console.log(
            "MASTERID RANGE: FULL"
        );

    }

    console.log(
        "======================================"
    );

    const response =
        await sendToTally(xml);

    if (!response) {
        throw new Error(
            "Empty response received from Tally."
        );
    }

    const json =
        parser.parse(response);

    const rawVouchers =
        json
            ?.ENVELOPE
            ?.BODY
            ?.DATA
            ?.COLLECTION
            ?.VOUCHER;

    const vouchers =
        toArray(rawVouchers);

    const result =
        vouchers
            .map(v => ({

                masterid:
                    Number(
                        getValue(v.MASTERID)
                    ),

                guid:
                    getValue(v.GUID),

                alterid:
                    Number(
                        getValue(v.ALTERID)
                    ),

                date:
                    getValue(v.DATE),

                voucherTypeName:
                    getValue(v.VOUCHERTYPENAME),

                voucherNumber:
                    getValue(v.VOUCHERNUMBER)

            }))
            .filter(row =>
                Number.isFinite(
                    row.masterid
                ) &&
                row.guid
            );

    console.log(
        "Vouchers Found:",
        result.length
    );

    console.log(
        "======================================"
    );

    return result;
}
    */

async function fetchVoucherIds({
    company,
    fromDate,
    toDate,
    booksBeginningFrom,
    lastAlterId,
    syncMode
}) {

    if (!company) {
        throw new Error(
            "company missing in fetchVoucherIds"
        );
    }

    if (!fromDate) {
        throw new Error(
            "fromDate missing in fetchVoucherIds"
        );
    }

    if (!toDate) {
        throw new Error(
            "toDate missing in fetchVoucherIds"
        );
    }

  
/*
if (!Number.isFinite(Number(lastAlterId))) {
    throw new Error(
        "lastAlterId missing or invalid in fetchVoucherIds"
    );
}
*/
    await selectCompany(company);

    let discoveryFromDate;
/*
    if (syncMode === "PERIODIC") {
        discoveryFromDate = fromDate;
    } else {
        discoveryFromDate = booksBeginningFrom;
    }
*/

     if (syncMode === "PERIODIC") {

        discoveryFromDate = fromDate;

    } else if (syncMode === "FULL") {

        discoveryFromDate = booksBeginningFrom;

    } else {

        // ALTERID / other incremental discovery
        discoveryFromDate = fromDate;

    }
    /*
    const hasAlterId =
    lastAlterId !== null &&
    lastAlterId !== undefined &&
    lastAlterId !== "" &&
    Number.isFinite(Number(lastAlterId));
*/

 const hasAlterId =
        lastAlterId !== null &&
        lastAlterId !== undefined &&
        lastAlterId !== "" &&
        Number.isFinite(Number(lastAlterId));

// ======================================================
// DATE FILTER
// ======================================================
// Agar ALTERID / MASTERID se fetch ho raha hai
// to DATE LIMITATION bilkul nahi.
// Date sirf pure date-based discovery mein lagegi.
// ======================================================

 const useAlterIdFilter =
        syncMode === "ALTERID" &&
        hasAlterId;
const filterXml = useAlterIdFilter
    ? `
<FILTER>
    BilleyVoucherSyncFilter
</FILTER>
`
    : "";

console.log("=== VOUCHER FILTER DEBUG ===");
console.log("syncMode:", syncMode);
console.log("lastAlterId:", lastAlterId);
console.log("hasAlterId:", hasAlterId);
console.log("discoveryFromDate:", discoveryFromDate);
console.log("toDate:", toDate);
console.log("useAlterIdFilter:", useAlterIdFilter);

/*

const useDateFilter =
    !hasAlterId;

//const useDateFilter = true;
const useDateFilter = true;

console.log("useDateFilter:", useDateFilter);
*/
    const xml = `
<ENVELOPE>

    <HEADER>

        <VERSION>1</VERSION>

        <TALLYREQUEST>Export</TALLYREQUEST>

        <TYPE>Collection</TYPE>

        <ID>BilleyVoucherIdCollection</ID>

    </HEADER>

    <BODY>

        <DESC>

          <STATICVARIABLES>

    <SVCURRENTCOMPANY>${company}</SVCURRENTCOMPANY>

    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>

   <SVFROMDATE TYPE="Date">20160401</SVFROMDATE>

<SVTODATE TYPE="Date">20991231</SVTODATE>

<SVCURRENTDATE TYPE="Date">20991231</SVCURRENTDATE>

</STATICVARIABLES>

            <TDL>

                <TDLMESSAGE>

                <COLLECTION NAME="BilleyVoucherIdCollection">

    <TYPE>Voucher</TYPE>

     ${filterXml}

    <FETCH>

        MASTERID,
        GUID,
        ALTERID,
        DATE,
        VOUCHERTYPENAME,
        VOUCHERNUMBER

    </FETCH>

</COLLECTION>
${
    useAlterIdFilter
        ? `
    <SYSTEM
        TYPE="Formulae"
        NAME="BilleyVoucherSyncFilter">

        $ALTERID > ${Number(lastAlterId)}

    </SYSTEM>
    `
        : ""
}

                </TDLMESSAGE>

            </TDL>

        </DESC>

    </BODY>

</ENVELOPE>
`;

console.log("=== FINAL VOUCHER DISCOVERY XML ===");
console.log(xml);
console.log("=== END VOUCHER DISCOVERY XML ===");

fs.writeFileSync(
    path.join(
        __dirname,
        "..",
        "logs",
        `VOUCHER-DISCOVERY-${Date.now()}.xml`
    ),
    xml,
    "utf8"
);

    console.log(
        "======================================"
    );

    console.log(
        "VOUCHER DISCOVERY REQUEST"
    );

    console.log(
        "Company:",
        company
    );

    console.log(
        "Date:",
        booksBeginningFrom,
        "→",
        toDate
    );
/*
    if (useMasterIdRange) {

        console.log(
            "MASTERID RANGE:",
            startMasterId,
            "→",
            endMasterId
        );

    } else {

        console.log(
            "MASTERID RANGE: FULL"
        );

    }
*/
    console.log(
        "======================================"
    );

    const response =
        await sendToTally(xml);

     fs.writeFileSync(
    path.join(__dirname, "../../logs/VOUCHER_DISCOVERY_DEBUG.xml"),
    String(response || ""),
    "utf8"
);

    if (!response) {
        throw new Error(
            "Empty response received from Tally."
        );
    }

    const json =
        parser.parse(response);

    const rawVouchers =
        json
            ?.ENVELOPE
            ?.BODY
            ?.DATA
            ?.COLLECTION
            ?.VOUCHER;

    const vouchers =
        toArray(rawVouchers);

    const result =
        vouchers
            .map(v => ({

                masterid:
                    Number(
                        getValue(v.MASTERID)
                    ),

                guid:
                    getValue(v.GUID),

                alterid:
                    Number(
                        getValue(v.ALTERID)
                    ),

                date:
                    getValue(v.DATE),

                voucherTypeName:
                    getValue(v.VOUCHERTYPENAME),

                voucherNumber:
                    getValue(v.VOUCHERNUMBER)

            }))
            .filter(row =>
                Number.isFinite(
                    row.masterid
                ) &&
                row.guid
            );

    console.log(
        "Vouchers Found:",
        result.length
    );

    console.log(
        "======================================"
    );

    return result;
}

async function fetchVoucherIdsInBatches({
    company,
    fromDate,
    toDate,
    booksBeginningFrom,
    lastAlterId,
    syncMode,
    batchSize = 50
}) {

    const voucherIds =
    await fetchVoucherIds({
        company,
        fromDate,
        toDate,
        booksBeginningFrom,
        lastAlterId,
        syncMode
    });
    const batches = [];

    for (
        let i = 0;
        i < voucherIds.length;
        i += batchSize
    ) {

        batches.push(
            voucherIds.slice(
                i,
                i + batchSize
            )
        );
    }

    return batches;
}

// ============================================================
// GENERIC TALLY COLLECTION HELPER
// ============================================================
async function fetchTallyCollection({
    company,
    collectionName,
    collectionType,
    fetchFields = [],
    filterName = null,
    filterFormula = null,
    masterIds = [],
    fromDate = null,
    toDate = null
}) {

    if (!company) {
        throw new Error(
            "company missing in fetchTallyCollection"
        );
    }

    if (!collectionName) {
        throw new Error(
            "collectionName missing in fetchTallyCollection"
        );
    }

    if (!collectionType) {
        throw new Error(
            "collectionType missing in fetchTallyCollection"
        );
    }

    await selectCompany(company);

    const fetchXml =
        fetchFields.length > 0
            ? `
                <FETCH>
                    ${fetchFields.join(",\n")}
                </FETCH>
              `
            : "";

    // ========================================================
    // MASTER ID FILTER
    // ========================================================

    let finalFilterName =
        filterName;

    let finalFilterFormula =
        filterFormula;

    if (
        Array.isArray(masterIds) &&
        masterIds.length > 0
    ) {

        const ids =
            masterIds
                .map(id => Number(id))
                .filter(
                    id => Number.isFinite(id)
                );

        if (ids.length === 0) {
            throw new Error(
                "masterIds contains no valid numbers"
            );
        }

        finalFilterName =
            "BilleyMasterIDListFilter";

        finalFilterFormula =
            "(" +
            ids
                .map(
                    id =>
                        `$MASTERID = ${id}`
                )
                .join(" OR ") +
            ")";
    }

    const filterXml =
        finalFilterName &&
        finalFilterFormula
            ? `
                <FILTER>
                    ${finalFilterName}
                </FILTER>
              `
            : "";

    const formulaXml =
        finalFilterName &&
        finalFilterFormula
            ? `
                <SYSTEM
                    TYPE="Formulae"
                    NAME="${finalFilterName}">
                    ${finalFilterFormula}
                </SYSTEM>
              `
            : "";

    // ========================================================
    // DATE VARIABLES
    // ========================================================

    const hasMasterIds =
    Array.isArray(masterIds) &&
    masterIds.length > 0;

const dateXml = `
    <SVFROMDATE TYPE="Date">
      ${fromDate || "20160401"}
    </SVFROMDATE>

    <SVTODATE TYPE="Date">
        ${toDate || "20991231"}
    </SVTODATE>

    <SVCURRENTDATE TYPE="Date">
        ${toDate || "20991231"}
    </SVCURRENTDATE>
`;

    const xml = `
<ENVELOPE>

    <HEADER>

        <VERSION>1</VERSION>

        <TALLYREQUEST>Export</TALLYREQUEST>

        <TYPE>Collection</TYPE>

        <ID>${collectionName}</ID>

    </HEADER>

    <BODY>

        <DESC>

            <STATICVARIABLES>

                <SVCURRENTCOMPANY>
                    ${company}
                </SVCURRENTCOMPANY>

                ${dateXml}

                <SVEXPORTFORMAT>
                    $$SysName:XML
                </SVEXPORTFORMAT>

            </STATICVARIABLES>

            <TDL>

                <TDLMESSAGE>

                    <COLLECTION NAME="${collectionName}">

                        <TYPE>${collectionType}</TYPE>

                        ${fetchXml}

                        ${filterXml}

                    </COLLECTION>

                    ${formulaXml}

                </TDLMESSAGE>

            </TDL>

        </DESC>

    </BODY>

</ENVELOPE>
`;

    console.log(
        "===================================="
    );

    console.log(
        "TALLY GENERIC COLLECTION REQUEST"
    );

    console.log(
        "Company:",
        company
    );

    console.log(
        "Collection:",
        collectionName
    );

    console.log(
        "Type:",
        collectionType
    );

    if (
        Array.isArray(masterIds) &&
        masterIds.length > 0
    ) {

        console.log(
            "MASTER IDS:",
            masterIds.length
        );

    }

    if (fromDate && toDate) {

        console.log(
            "Date:",
            fromDate,
            "→",
            toDate
        );

    }

    if (finalFilterFormula) {

        console.log(
            "Filter:",
            finalFilterFormula
        );

    }

    console.log(
        "===================================="
    );

    return await sendToTally(xml);
}
/*
async function fetchTallyCollectionByVoucherId({
    company,
    voucherId,
    fetchFields = []
}) {

    
    if (!company) {
        throw new Error(
            "company missing in fetchTallyCollectionByVoucherId"
        );
    }

    if (
        voucherId === undefined ||
        voucherId === null ||
        voucherId === ""
    ) {
        throw new Error(
            "voucherId missing in fetchTallyCollectionByVoucherId"
        );
    }

    if (
        !Number.isFinite(
            Number(voucherId)
        )
    ) {
        throw new Error(
            "voucherId must be a number"
        );
    }

    // ========================================================
    // SAME COMPANY SELECTION USED BY OTHER TALLY FUNCTIONS
    // ========================================================

    await selectCompany(company);

    // ========================================================
    // FETCH
    // ========================================================

    const fields =
        fetchFields.length > 0
            ? fetchFields
            : [
                "GUID",
                "MASTERID",
                "ALTERID",
                "DATE",
                "EFFECTIVEDATE",
                "VOUCHERTYPENAME",
                "VOUCHERNUMBER",
                "REFERENCE",
                "REFERENCEDATE",
                "PARTYLEDGERNAME",
                "NARRATION",
                "ISINVOICE",
                "ISOPTIONAL",
                "ISCANCELLED"
            ];

    const fetchXml = `
    <FETCH>
        ${fields.join(",\n")}
    </FETCH>
    `;

    // ========================================================
    // PROVEN WORKING XML STRUCTURE
    // ========================================================

    const xml = `
<ENVELOPE>

    <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Export</TALLYREQUEST>
        <TYPE>Collection</TYPE>
        <ID>BilleyVoucherCollection</ID>
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

                    <COLLECTION NAME="BilleyVoucherCollection">

                        <TYPE>Voucher</TYPE>

                        ${fetchXml}

                        <FILTER>
                            BilleyVoucherIdFilter
                        </FILTER>

                    </COLLECTION>

                    <SYSTEM
                        TYPE="Formulae"
                        NAME="BilleyVoucherIdFilter">

                        $MASTERID = ${Number(voucherId)}

                    </SYSTEM>

                </TDLMESSAGE>

            </TDL>

        </DESC>

    </BODY>

</ENVELOPE>
`;

    // ========================================================
    // SAVE REQUEST XML
    // ========================================================

    const requestFile =
        path.join(
            __dirname,
            "..",
            "logs",
            "voucher-master-id-request.xml"
        );

    fs.writeFileSync(
        requestFile,
        xml
    );

    // ========================================================
    // DEBUG
    // ========================================================

    console.log(
        "===================================="
    );

    console.log(
        "TALLY VOUCHER MASTER ID REQUEST"
    );

    console.log(
        "Company:",
        company
    );

    console.log(
        "Voucher MasterID:",
        Number(voucherId)
    );

    console.log(
        "Request XML:",
        requestFile
    );

    console.log(
        "===================================="
    );

    // ========================================================
    // SEND TO TALLY
    // ========================================================

    const result =
        await sendToTally(xml);

    return result;
}
*/
async function fetchTallyCollectionByVoucherId({
    company,
    voucherId,
    fetchFields = []
}) {

    

    if (!company) {
        throw new Error(
            "company missing in fetchTallyCollectionByVoucherId"
        );
    }

    if (
        voucherId === undefined ||
        voucherId === null ||
        voucherId === ""
    ) {
        throw new Error(
            "voucherId missing in fetchTallyCollectionByVoucherId"
        );
    }

    if (
        !Number.isFinite(
            Number(voucherId)
        )
    ) {
        throw new Error(
            "voucherId must be a number"
        );
    }

    const fields =
        fetchFields.length > 0
            ? fetchFields
            : [
                "GUID",
                "MASTERID",
                "ALTERID",
                "DATE",
                "EFFECTIVEDATE",
                "VOUCHERTYPENAME",
                "VOUCHERNUMBER",
                "REFERENCE",
                "REFERENCEDATE",
                "PARTYLEDGERNAME",
                "NARRATION",
                "ISINVOICE",
                "ISOPTIONAL",
                "ISCANCELLED"
            ];

    /*
     * IMPORTANT:
     *
     * Caller ko date dene ki zarurat nahi.
     *
     * Tally ke Voucher collection ko old vouchers
     * resolve karne ke liye date context chahiye.
     *
     * Isliye date context yahin internally diya ja raha hai.
     */

 

    return await fetchTallyCollection({

        company,

        collectionName:
            "BilleyVoucherCollection",

        collectionType:
            "Voucher",

        fetchFields:
            fields,

        filterName:
            "BilleyVoucherIdFilter",

        filterFormula:
            `$MASTERID = ${Number(voucherId)}`,

        fromDate: null,
        toDate: null

    });
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

const path = require("path");

const outputFile = path.join(
    __dirname,
    "sales-vouchers.xml"
);



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
  fetchTallyCollection,

  // =========================
  // MASTER FLOW
  // =========================
  fetchMasterIds,
  fetchMasterIdsInBatches,
  fetchMastersInBatches,

  // =========================
  // VOUCHER FLOW
  // =========================
  fetchVoucherIds,
  fetchVoucherIdsInBatches,
  fetchVouchersInBatches,

  // =========================
  // EXISTING HELPERS
  // =========================
  fetchTallyCollectionByMasterId,
  fetchTallyCollectionByVoucherId,

  // =========================
  // OTHER FUNCTIONS
  // =========================
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

  // getStockMasters

};