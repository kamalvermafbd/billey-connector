const fs = require("fs");

const {
    importStocks
} = require("./src/tally/stockImportService");

(async () => {

    const stocks = await importStocks({

        company: "Sunil Ent(Client"

    });

    fs.writeFileSync(
        "./stocks-output.json",
        JSON.stringify(stocks, null, 2),
        "utf8"
    );

    console.log("Stocks Imported.");

})();