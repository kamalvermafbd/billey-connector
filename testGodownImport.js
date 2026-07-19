const fs = require("fs");

const {
    importGodowns
} = require("./src/tally/godownImportService");

(async () => {

    const godowns = await importGodowns({

        company: "Sunil Ent(Client)"

    });

    fs.writeFileSync(
        "./godowns-output.json",
        JSON.stringify(godowns, null, 2),
        "utf8"
    );

    console.log("Godowns Imported.");

})();