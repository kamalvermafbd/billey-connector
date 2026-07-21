const fs = require("fs");

const {
    importCostCentres
} = require("./src/tally/costCentreImportService");

(async () => {

    const costCentres = await importCostCentres({

        company: "Sunil Ent(Client"

    });

    fs.writeFileSync(
        "./cost-centres-output.json",
        JSON.stringify(costCentres, null, 2),
        "utf8"
    );

    console.log("Cost Centres Imported.");

})();