const fs = require("fs");

const {
    importStocks
} = require("./src/tally/stockImportService");

(async () => {

    const stocks = await importStocks({

        company: "Sunil Ent(Client"

    });

   

    console.log("Stocks Imported.");

})();