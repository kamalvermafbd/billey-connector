const fs = require("fs");

const {
    importUnits
} = require("./src/tally/unitImportService");

(async () => {

    const units = await importUnits({

        company: "Sunil Ent(Client"

    });

    

    console.log("Units Imported.");

})();