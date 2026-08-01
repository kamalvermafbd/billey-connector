const fs = require("fs");

const {
    importCompany
} = require("./companyImportService");

const {
    importGroups
} = require("./groupImportService");

const {
    importUnits
} = require("./unitImportService");

const {
    importLedgers
} = require("./ledgerImportService");

const {
    importStockGroups
} = require("./stockGroupImportService");

const {
    importStocks
} = require("./stockImportService");

const {
    importGodowns
} = require("./godownImportService");

const {
    importCostCentres
} = require("./costCentreImportService");


const {
    importVouchers,
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
    lastStockAlterId = null
}) {

    console.log("======================================");
    console.log("Starting Tally Master Import");
    console.log("Company :", company);
    console.log("======================================");

    console.log("Importing Company...");

    const companyInfo = await importCompany({
        company
    });

    
    console.log(
        `✓ Company Imported : ${companyInfo.companyName}`
    );

    if (!companyInfo.booksBeginningFrom) {
    throw new Error(
        `Books Beginning From not found for company: ${company}`
    );
    }

    console.log("Importing Groups...");

    const groups = await importGroups({
        company
    });

    console.log(`✓ Groups Imported : ${groups.length}`);

    console.log("Importing Units...");
    const units = await importUnits({
        company
    });

    console.log(`✓ Units Imported : ${units.length}`);

    console.log("Importing Ledgers...");
    const ledgers = await importLedgers({
    company,
    booksBeginningFrom:
        companyInfo.booksBeginningFrom
    });

    


    console.log(`✓ Ledgers Imported : ${ledgers.length}`);


    console.log("Importing Stock Groups...");

    const stockGroups = await importStockGroups({
        company
    });

    console.log(`✓ Stock Groups Imported : ${stockGroups.length}`);



    console.log("Importing Stocks...");
    const stocks = await importStocks({
    company,
    lastStockAlterId
});

    console.log(`✓ Stocks Imported : ${stocks.length}`);

   const lookups = buildTallyLookups({
    groups,
    ledgers,
    stocks
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

console.log("Importing Vouchers...");

const voucherResult = await importVouchers({
    company,
    fromDate: companyInfo.booksBeginningFrom,
    lastAlterId,
    lookups
});

const voucherGuids = await importVoucherGuids({
    company
});

console.log(
    "Voucher GUID Count :",
    voucherGuids.length
);

const vouchers = voucherResult.vouchers || [];

console.log(`✓ Vouchers Imported : ${vouchers.length}`);

//console.log("Importing Voucher Types...");
//const voucherTypes = await importVoucherTypes({
 //   company
//});

//console.log(`✓ Voucher Types Imported : ${voucherTypes.length}`);

  console.log("======================================");
    console.log("Master Import Completed");
    console.log("======================================");

    
return {

   summary: {

    company,

    companyName: companyInfo.companyName,

    booksBeginningFrom:
        companyInfo.booksBeginningFrom,

    imported_at: new Date().toISOString(),

    groups: groups.length,

    units: units.length,

    ledgers: ledgers.length,

    stockGroups: stockGroups.length,

    stocks: stocks.length,

    godowns: godowns.length,
    costCentres: costCentres.length,
    vouchers: vouchers.length,
    voucherGuids: voucherGuids.length,

    totalMasters:
    groups.length +
    units.length +
    ledgers.length +
    stockGroups.length +
    stocks.length +
    godowns.length +
    costCentres.length +
    vouchers.length
   

},

    groups,

    units,

    ledgers,

    stockGroups,

    stocks,

    godowns,
    costCentres,
    vouchers,
    voucherGuids
    

};

}

module.exports = {
    importMasters
};