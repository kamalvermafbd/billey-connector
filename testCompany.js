const fs = require("fs");

const {
    importCompany
} = require("./src/tally/companyImportService");

(async () => {

    const company = await importCompany({

        company: "Sunil Ent(Client"

    });

 

    console.log("Company Imported.");

})();