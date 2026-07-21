const fs = require("fs");

const {
    importAllMasters
} = require("./src/tally/allMastersImportService");

(async () => {

    const response = await importAllMasters({

        company: "Sunil Ent(Client"

    });

    fs.writeFileSync(
        "./all-masters-output.xml",
        response,
        "utf8"
    );

    console.log("All Masters Exported.");

})();