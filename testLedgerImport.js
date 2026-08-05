const fs = require("fs");
const path = require("path");



const {
    importMasters
} = require("./src/tally/importMasters");


(async () => {

    try {
        const result =

            await importMasters({

                company: "Guru Kirpa Trading)"

            });

        const ledgers =

            result.ledgers;


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

     const debugData = {

            summary:

                result.summary,

            totalLedgers:

                ledgers.length,

            firstLedger: {

                guid:

                    ledgers[0]?.guid,

                parent:

                    ledgers[0]?.parent,

                parentGuid:

                    ledgers[0]?.parentGroupGuid,

                parentMasterId:

                    ledgers[0]?.parentGroupMasterId,

                parentAlterId:

                    ledgers[0]?.parentGroupAlterId

            },

            allLedgers:

                ledgers

        };

        fs.writeFileSync(

            filePath,

            JSON.stringify(

                debugData,

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