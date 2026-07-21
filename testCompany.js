const fs = require("fs");

const {
    importCompany
} = require("./src/tally/companyImportService");

(async () => {

    const company = await importCompany({

        company: "Sunil Ent(Client"

    });

    fs.writeFileSync(
        "./company-output.json",
        JSON.stringify(company, null, 2),
        "utf8"
    );

    console.log("Company Imported.");

})();