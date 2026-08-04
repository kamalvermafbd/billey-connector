const fs = require("fs");
const path = require("path");

const {
    importGodownGuids
} = require("./src/tally/godownGuidImportService");


(async () => {

    try {

        const godownGuids =
            await importGodownGuids({

                company: "Sunil Ent(Client)"

            });


        console.log(
            "Total Godown GUIDs:",
            godownGuids.length
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
                "godownGuids.json"
            );


       


        console.log(
            "Godown GUID JSON Generated:",
            filePath
        );


    }
    catch(error) {

        console.error(
            "Godown GUID Import Failed"
        );

        console.error(error);

    }

})();