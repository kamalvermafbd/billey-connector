const fs = require("fs");
const path = require("path");

const {
    importCostCentreGuids
} = require("./src/tally/costCentreGuidImportService");


(async () => {

    try {

        const costCentreGuids =
            await importCostCentreGuids({

                company: "Sunil Ent(Client)"

            });


        console.log(
            "Total Cost Centre GUIDs:",
            costCentreGuids.length
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
                "costCentreGuids.json"
            );


        fs.writeFileSync(
            filePath,
            JSON.stringify(
                costCentreGuids,
                null,
                2
            )
        );


        console.log(
            "Cost Centre GUID JSON Generated:",
            filePath
        );


    }
    catch(error) {

        console.error(
            "Cost Centre GUID Import Failed"
        );

        console.error(error);

    }

})();