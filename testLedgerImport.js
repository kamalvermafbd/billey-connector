const fs = require("fs");

const {
    importLedgers
} = require("./src/tally/ledgerImportService");

(async () => {

    const ledgers = await importLedgers({

        company: "Sunil Ent(Client"

    });

    fs.writeFileSync(
        "./ledgers-output.json",
        JSON.stringify(ledgers, null, 2),
        "utf8"
    );

    console.log("Ledgers Imported.");

})();