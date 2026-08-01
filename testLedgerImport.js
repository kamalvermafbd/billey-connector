const fs = require("fs");
const path = require("path");

const {
    importLedgerGuids
} = require("./src/tally/ledgerGuidImportService");


(async () => {

    try {

        const ledgers =
            await importLedgerGuids({

                company: "Sunil Ent(Client)"

            });


        console.log(
            "Total Ledger GUIDs:",
            ledgers.length
        );


        const logDir =
            path.join(
                __dirname,
                "src",
                "logs"
            );


        if (!fs.existsSync(logDir)) {

            fs.mkdirSync(
                logDir,
                {
                    recursive:true
                }
            );

        }


        const filePath =
            path.join(
                logDir,
                "ledgerGuids.json"
            );


        fs.writeFileSync(
            filePath,
            JSON.stringify(
                ledgers,
                null,
                2
            )
        );


        console.log(
            "Ledger GUID JSON generated:",
            filePath
        );


    }
    catch(err) {

        console.error(
            "Ledger GUID Import Failed"
        );

        console.error(err);

    }

})();