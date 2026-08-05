const fs = require("fs");
const path = require("path");

const {
    importMasters
} = require("./src/tally/importMasters");

(async () => {

    try {

        const result =

            await importMasters({

                company: "Sunil Ent(Client"

            });

        const stocks =

            result.stocks;

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
                "stockGuids.json"
            );

        const debugData = {

            summary:

                result.summary,

            totalStocks:

                stocks.length,

            firstStock: {

                guid:

                    stocks[0]?.guid,

                parent:

                    stocks[0]?.parent,

                parentGroupGuid:

                    stocks[0]?.parentGroupGuid,

                parentGroupMasterId:

                    stocks[0]?.parentGroupMasterId,

                parentGroupAlterId:

                    stocks[0]?.parentGroupAlterId

            },

            allStocks:

                stocks

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
            "Stock GUID JSON generated:",
            filePath
        );

    }

    catch (err) {

        console.error(
            "Stock GUID Import Failed"
        );

        console.error(err);

    }

})();