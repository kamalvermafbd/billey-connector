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
    importStocks
} = require("./stockImportService");

const {
    importGodowns
} = require("./godownImportService");

const {
    importCostCentres
} = require("./costCentreImportService");

const {
    importVoucherTypes
} = require("./voucherTypeImportService");



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

    console.log(`✓ Ledgers Imported : ${ledgers.length}`);

    console.log("Importing Stocks...");
    const stocks = await importStocks({
        company
    });

    console.log(`✓ Stocks Imported : ${stocks.length}`);

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

console.log("Importing Voucher Types...");
const voucherTypes = await importVoucherTypes({
    company
});

console.log(`✓ Voucher Types Imported : ${voucherTypes.length}`);

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

    stocks: stocks.length,

    godowns: godowns.length,
    costCentres: costCentres.length,
    voucherTypes: voucherTypes.length

},

    groups,

    units,

    ledgers,

    stocks,

    godowns,
    costCentres,
    voucherTypes

};

}

module.exports = {
    importMasters
};