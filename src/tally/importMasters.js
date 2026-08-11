const fs = require("fs");


const {
    importCompany
} = require("./companyImportService");

const {
    importGroups
} = require("./groupImportService");

const {
    fetchMasterIdsInBatches
} = require("./tallyService");


const {
    importUnits
} = require("./unitImportService");

const {
    importVouchers
} = require("./voucherImportService");

const {
    importVoucherBulkByGuid
} = require("./voucherImportServiceBulkGuid");

const {
    importLedgers
} = require("./ledgerImportService");

const {
importLedgerBulkByGuid
} = require("./ledgerImportServiceBulkGuid");

const {
    importStockGroups
} = require("./stockGroupImportService");

const {
    importStocks
} = require("./stockImportService");

const {
importStockBulkByGuid
} = require("./stockImportServiceBulkGuid");


const {
    importGodowns
} = require("./godownImportService");

const {
    importCostCentres
} = require("./costCentreImportService");

const {
    importVoucherGuids
} = require("./voucherImportService");

const {
    buildTallyLookups
} = require("./tallyLookups");



// ============================================================
// 30072026
// Bulk Voucher GUID Import
// Lookup cache support for reconciliation flow.
// Existing incremental import remains unchanged.
// ============================================================
const {
    setLookups
} = require("./lookupCache");

///----

async function importMasters({
    company,
    lastAlterId = null,
    lastStockAlterId = null,
    lastLedgerAlterId = null
}) {

    console.log("======================================");
    console.log("Starting Tally Master Import");
    console.log("Company :", company);
    console.log("======================================");

    console.log("Importing Company...");

    const companyInfo = await importCompany({
        company
    });

console.log("After importCompany");

//companyInfo.booksBeginningFrom = "20210401";
    
    console.log(
        `✓ Company Imported : ${companyInfo.companyName}`
    );

    if (!companyInfo.booksBeginningFrom) {
    throw new Error(
        `Books Beginning From not found for company: ${company}`
    );
    }

   console.log("Importing Groups...");

const masterBatches =
    await fetchMasterIdsInBatches({
        company,
        batchSize: 50
    });

const groups = [];

for (const batch of masterBatches) {

    const batchGroups =
        await importGroups({
            company,
            masterIds: batch
        });

    groups.push(
        ...batchGroups
    );
    }

    console.log(
        `✓ Groups Imported : ${groups.length}`
    );

    console.log("######## AFTER GROUPS ########");

    // ============================================================
// Temporary lookup.
// Groups are required before Ledger import so parent
// group GUIDs can be resolved.
// ============================================================

    const masterLookups =

    buildTallyLookups({

        groups,

        ledgers: [],

        stocks: []

    });

    setLookups(

        company,

        masterLookups

    );

    console.log("Importing Units...");
    const units = await importUnits({
        company
    });

    console.log(`✓ Units Imported : ${units.length}`);

/*
    console.log("Importing Ledgers...");

    // incremental ledgers save ke liye
    const ledgers = await importLedgers({
        company,
        booksBeginningFrom:
            companyInfo.booksBeginningFrom,
        lastLedgerAlterId
    });

    console.log(`✓ Changed Ledgers Imported : ${ledgers.length}`);
*/

console.log("Importing Ledgers...");

// ============================================
// STEP 1: ALTERID se changed Ledgers lao
// GUID already response mein available hai
// ============================================

const changedLedgers =
    await importLedgers({
        company,
        booksBeginningFrom:
            companyInfo.booksBeginningFrom,
        lastLedgerAlterId
    });

console.log(
    `✓ Changed Ledgers Detected : ${changedLedgers.length}`
);


// ============================================
// STEP 2: Changed Ledgers se GUIDs nikalo
// ============================================

const changedLedgerGuids =
    changedLedgers
        .map(ledger => ledger.guid)
        .filter(Boolean);

console.log(
    `✓ Changed Ledger GUIDs : ${changedLedgerGuids.length}`
);


// ============================================
// STEP 3: Existing Bulk GUID Pipeline
// 50 GUID Level-1 already handled there
// ============================================

const ledgers =
    await importLedgerBulkByGuid({
        company,
        ledgerGuids: changedLedgerGuids
    });

console.log(
    `✓ Changed Ledgers Imported : ${ledgers.length}`
);

    // full ledger list sirf lookup ke liye
    const allLedgers = await importLedgers({
        company,
        booksBeginningFrom:
            companyInfo.booksBeginningFrom,
        lastLedgerAlterId: null
    });

    console.log(`✓ Full Ledger Lookup Imported : ${allLedgers.length}`);
    console.log("######## AFTER ALL LEDGERS ########");

    fs.writeFileSync(

    "ledgerLookupDebug.json",

    JSON.stringify(

        allLedgers[0],

        null,

        2

    )

);

console.log(
    "ledgerLookupDebug.json generated"
);

    console.log("Importing Stock Groups...");

    const stockGroups = await importStockGroups({
        company
    });

    console.log(`✓ Stock Groups Imported : ${stockGroups.length}`);

    const stockLookups = buildTallyLookups({

        groups,

        ledgers: [],

        stocks: stockGroups

    });

    setLookups(

        company,

        stockLookups

    );

    console.log("Importing Stocks...");

// ============================================
// STEP 1: ALTERID se changed Stocks lao
// GUID already response mein available hai
// ============================================

const changedStocks =
await importStocks({
    company,
    lastStockAlterId
});

console.log(
    `✓ Changed Stocks Detected : ${changedStocks.length}`
);


// ============================================
// STEP 2: Changed Stocks se GUIDs nikalo
// ============================================

const changedStockGuids =
changedStocks
    .map(stock => stock.guid)
    .filter(Boolean);

console.log(
    `✓ Changed Stock GUIDs : ${changedStockGuids.length}`
);


// ============================================
// STEP 3: Existing Bulk GUID Pipeline
// 50 GUID Level-1 already handled there
// ============================================

const stocks =
await importStockBulkByGuid({
    company,
    stockGuids: changedStockGuids
});

console.log(
    `✓ Changed Stocks Imported : ${stocks.length}`
);

    const allStocks = await importStocks({
    company,
    lastStockAlterId:null
});

    console.log(`✓ All Stocks Imported : ${allStocks.length}`);
    console.log("######## AFTER ALL STOCKS ########");

  const lookups = buildTallyLookups({
    groups,
    ledgers: allLedgers,
    stocks: allStocks
});

// ============================================================
// 30072026
// Bulk Voucher GUID Import
// Cache lookups so Bulk GUID reconciliation can reuse the
// existing parser without rebuilding master lookups.
// ============================================================
setLookups(company, lookups);

///----


console.log("Ledger Lookup :", lookups.ledgerLookup.size);
console.log("Stock Lookup :", lookups.stockLookup.size);

console.log(
    "Purchase Local :",
    lookups.ledgerLookup.get("PURCHASE LOCAL")
);

console.log(
    "Purchase IGST :",
    lookups.ledgerLookup.get("PURCHASE IGST")
);

    console.log("Importing Godowns...");
    const godowns = await importGodowns({
        company
    });

    console.log(`✓ Godowns Imported : ${godowns.length}`);

    console.log("Importing Cost Centres...");
const costCentres = await importCostCentres({
    company
});

console.log(`✓ Cost Centres Imported : ${costCentres.length}`);
console.log("######## AFTER COST CENTRES ########");

console.log("Importing Vouchers...");



// ============================================
// PHASE 1: FULL VOUCHER GUID DISCOVERY
// Level-1 = 50 GUIDs
// ============================================

console.log("Importing Full Voucher GUIDs...");
/*
const voucherGuids =
    await importVoucherGuids({
        company,
        fromDate:
            companyInfo.booksBeginningFrom,
        toDate:
            new Date()
                .toISOString()
                .slice(0, 10)
                .replace(/-/g, "")
    });

console.log(
    `✓ Total Voucher GUIDs Discovered : ${voucherGuids.length}`
);
*/

const voucherRecords =
    await importVoucherGuids({
        company,
        fromDate: companyInfo.booksBeginningFrom,
        toDate:
            new Date()
                .toISOString()
                .slice(0, 10)
                .replace(/-/g, "")
    });

const voucherGuids =
    voucherRecords
        .map(row => row.guid)
        .filter(Boolean);

        console.log(
    "Voucher GUID sample:",
    voucherGuids.slice(0, 3)
);


// ============================================
// STEP 1: ALTERID se changed Vouchers lao
// GUID already response mein available hai
// ============================================
/*temp comment5 110826
const voucherResult =
    await importVouchers({
        company,
        fromDate:
            companyInfo.booksBeginningFrom,
        // toDate: "20270401",
        lastAlterId,
        lookups
    });

const changedVouchers =
    voucherResult.vouchers || [];

console.log(
    `✓ Changed Vouchers Detected : ${changedVouchers.length}`
);


// ============================================
// STEP 2: Changed Vouchers se GUIDs nikalo
// ============================================

const changedVoucherGuids =
    changedVouchers
        .map(voucher => voucher.guid)
        .filter(Boolean);

console.log(
    `✓ Changed Voucher GUIDs : ${changedVoucherGuids.length}`
);
*/

// ============================================
// STEP 3: Existing Bulk GUID Pipeline
// Voucher Level-1 = 25 GUID
// XML safety limit = 300 KB
// ============================================

const vouchers =
    await importVoucherBulkByGuid({
        company,
        voucherGuids
    });

console.log(
    `✓ Changed Vouchers Imported : ${vouchers.length}`
);

console.log(
    "######## AFTER VOUCHER BULK GUIDS ########"
);

//console.log("Importing Voucher Types...");
//const voucherTypes = await importVoucherTypes({
 //   company
//});

//console.log(`✓ Voucher Types Imported : ${voucherTypes.length}`);

  console.log("======================================");
    console.log("Master Import Completed");
    console.log("======================================");

    console.log("######## IMPORT MASTERS FINISHED ########");
return {

   summary: {

    company,

    companyName: companyInfo.companyName,

    booksBeginningFrom:
        companyInfo.booksBeginningFrom,

    imported_at: new Date().toISOString(),

    groups: groups.length,

    units: units.length,

    ledgers: allLedgers.length,

    stockGroups: stockGroups.length,

    stocks: stocks.length,
    allStocks: allStocks.length,

    godowns: godowns.length,
    costCentres: costCentres.length,
    vouchers: vouchers.length,
    //voucherGuids: voucherGuids.length,

    totalMasters:
    groups.length +
    units.length +
    allLedgers.length +
    stockGroups.length +
    stocks.length +
    godowns.length +
    costCentres.length +
    vouchers.length
   

},

    groups,

    units,

    ledgers,

    allLedgers,

    stockGroups,

    stocks,

    allStocks,

    godowns,
    costCentres,
    vouchers,
    //voucherGuids
    

};

}

module.exports = {
    importMasters
};