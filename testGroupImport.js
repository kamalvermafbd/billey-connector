const fs = require("fs");

const {
    importGroups
} = require("./src/tally/groupImportService");

(async () => {

    const groups = await importGroups({

        company: "Sunil Ent(Client"

    });

    

    console.log("Groups Imported.");

})();