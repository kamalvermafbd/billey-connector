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

// const {
 //   importVoucherTypes
//} = require("./voucherTypeImportService");

const {
    importVouchers
} = require("./voucherImportService");

async function importMasters({
    company
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

    const ledgerLookup = new Map(
    ledgers.map(l => [
        (l.name || "").toUpperCase(),
        l
    ])
    );

    console.log("================================");



console.log(
    "Purchase Local Lookup :",
    ledgerLookup.get("PURCHASE LOCAL")
);

console.log(
    "Raja Babu Lookup :",
    ledgerLookup.get("RAJA BABU")
);

console.log("================================");
const partyLookup = new Map(
    ledgers
        .filter(l => l.isParty)
        .map(l => [
            (l.name || "").toUpperCase(),
            l
        ])
);


const groupLookup = new Map(
    groups.map(g => [
        (g.name || "").trim().toUpperCase(),
        g
    ])
);

    console.log(
    "PURCHASE IGST LEDGER =>",
    ledgers.find(
        x =>
            (x.name || "").toUpperCase() ===
            "PURCHASE IGST"
    )
);



console.log(
    ledgers
        .filter(x =>
            (x.name || "")
                .toUpperCase()
                .includes("PURCHASE")
        )
        .map(x => ({
            name: x.name,
            parent: x.parent
        }))
);



    console.log(`✓ Ledgers Imported : ${ledgers.length}`);


    console.log("Importing Stock Groups...");

    const stockGroups = await importStockGroups({
        company
    });

    console.log(`✓ Stock Groups Imported : ${stockGroups.length}`);



    console.log("Importing Stocks...");
    const stocks = await importStocks({
        company
    });

    console.log(`✓ Stocks Imported : ${stocks.length}`);

    const stockLookup = new Map(
    stocks.map(s => [
        String(s.masterId || ""),
        s
    ])
);

const lookups = {
    ledgerLookup,
    stockLookup,
    partyLookup,
    groupLookup
};

console.log("Ledger Lookup :", ledgerLookup.size);
console.log("Stock Lookup :", stockLookup.size);
console.log("Purchase Local :", ledgerLookup.get("PURCHASE LOCAL"));
console.log("Purchase IGST :", ledgerLookup.get("PURCHASE IGST"));

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
    lookups
});

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
    vouchers
    

};

}

module.exports = {
    importMasters
};