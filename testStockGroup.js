const fs = require("fs");

const {
    importStockGroups
} = require("./src/tally/stockGroupImportService");

(async () => {

    const stockGroups = await importStockGroups({

        company: "Sunil Ent(Client"

    });

   

    console.log("Stock Groups Imported.");

})();