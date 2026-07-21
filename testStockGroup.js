const fs = require("fs");

const {
    importStockGroups
} = require("./src/tally/stockGroupImportService");

(async () => {

    const stockGroups = await importStockGroups({

        company: "Sunil Ent(Client"

    });

    fs.writeFileSync(
        "./stock-groups-output.json",
        JSON.stringify(stockGroups, null, 2),
        "utf8"
    );

    console.log("Stock Groups Imported.");

})();