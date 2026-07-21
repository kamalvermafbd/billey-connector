const fs = require("fs");

const {
    importMasters
} = require("./src/tally/importMasters");

(async () => {

    const masters = await importMasters({

        company: "Sunil Ent(Client)"

    });

    fs.writeFileSync(
        "./masters-output.json",
        JSON.stringify(masters, null, 2),
        "utf8"
    );

    console.log("");
    console.log("========== SUMMARY ==========");
    console.log("Groups   :", masters.groups.length);
    console.log("Units    :", masters.units.length);
    console.log("Ledgers  :", masters.ledgers.length);
    console.log("Stocks   :", masters.stocks.length);
    console.log("Godowns  :", masters.godowns.length);
    console.log("=============================");
    console.log("");
    console.log("masters-output.json created successfully.");

})();