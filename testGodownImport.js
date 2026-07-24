const fs = require("fs");

const {
    importGodowns
} = require("./src/tally/godownImportService");

(async () => {

    const godowns = await importGodowns({

        company: "Sunil Ent(Client)"

    });

    

    console.log("Godowns Imported.");

})();