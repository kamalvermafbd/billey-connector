const fs = require("fs");

const {
    importCostCentres
} = require("./src/tally/costCentreImportService");

(async () => {

    const costCentres = await importCostCentres({

        company: "Sunil Ent(Client"

    });

    

    console.log("Cost Centres Imported.");

})();