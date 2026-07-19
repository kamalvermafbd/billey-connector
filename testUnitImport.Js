const fs = require("fs");

const {
    importUnits
} = require("./src/tally/unitImportService");

(async () => {

    const units = await importUnits({

        company: "Sunil Ent(Client"

    });

    fs.writeFileSync(
        "./units-output.json",
        JSON.stringify(units, null, 2),
        "utf8"
    );

    console.log("Units Imported.");

})();