const fs = require("fs");

const {
    importAllMasters
} = require("./src/tally/allMastersImportService");

(async () => {

    const response = await importAllMasters({

        company: "Sunil Ent(Client"

    });

    

    console.log("All Masters Exported.");

})();