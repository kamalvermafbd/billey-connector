const fs = require("fs");
const path = require("path");

const {
    importUnitGuids
} = require("./src/tally/unitGuidImportService");


(async () => {

    try {

        const unitGuids =
            await importUnitGuids({

                company: "Sunil Ent(Client)"

            });


        console.log(
            "Total Unit GUIDs:",
            unitGuids.length
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
                "unitGuids.json"
            );


    


        console.log(
            "Unit GUID JSON Generated:",
            filePath
        );


    }
    catch(error) {

        console.error(
            "Unit GUID Import Failed"
        );

        console.error(error);

    }

})();