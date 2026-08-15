const fs = require("fs");
const path = require("path");

const {
    importStockGroupGuids
} = require("./src/tally/stockGroupGuidImportService");


(async () => {

    const company =
        "Guru Kirpa Trading";

    try {

        const stockGroupGuids =
            await importStockGroupGuids({
                company
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
                    recursive: true
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
                {
                    company,
                    totalStockGroupGuids:
                        stockGroupGuids.length,
                    stockGroupGuids
                },
                null,
                2
            ),

            "utf8"

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