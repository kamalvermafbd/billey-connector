const fs = require("fs");
const path = require("path");

const {
    importStockGuids
} = require("./src/tally/stockGuidImportService");


(async () => {

    try {

        const stockGuids =
            await importStockGuids({

                company: "Sunil Ent(Client)"

            });


        console.log(
            "Total Stock GUIDs:",
            stockGuids.length
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
                "stockGuids.json"
            );


        fs.writeFileSync(
            filePath,
            JSON.stringify(
                stockGuids,
                null,
                2
            )
        );


        console.log(
            "Stock GUID JSON Generated:",
            filePath
        );


    }
    catch(error) {

        console.error(
            "Stock GUID Import Failed"
        );

        console.error(error);

    }

})();