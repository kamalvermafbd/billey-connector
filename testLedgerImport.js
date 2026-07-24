const fs = require("fs");

const {
    importLedgers
} = require("./src/tally/ledgerImportService");

(async () => {

    const ledgers = await importLedgers({

        company: "Sunil Ent(Client"

    });


    console.log("Ledgers Imported.");

})();