const fs = require("fs");

const {
    importGroups
} = require("./src/tally/groupImportService");

(async () => {

    const groups = await importGroups({

        company: "Sunil Ent(Client"

    });

    fs.writeFileSync(
        "./groups-output.json",
        JSON.stringify(groups, null, 2),
        "utf8"
    );

    console.log("Groups Imported.");

})();