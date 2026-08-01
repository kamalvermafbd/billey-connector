const fs = require("fs");
const path = require("path");

const {
    importStockGroupGuids
} = require("./src/tally/stockGroupGuidImportService");


(async () => {

    try {

        const stockGroupGuids =
            await importStockGroupGuids({

                company: "Sunil Ent(Client)"

            });


        console.log(
            "Total Stock Group GUIDs:",
            stockGroupGuids.length
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
                "stockGroupGuids.json"
            );


        fs.writeFileSync(
            filePath,
            JSON.stringify(
                stockGroupGuids,
                null,
                2
            )
        );


        console.log(
            "Stock Group GUID JSON Generated:",
            filePath
        );


    }
    catch(error) {

        console.error(
            "Stock Group GUID Import Failed"
        );

        console.error(error);

    }

})();