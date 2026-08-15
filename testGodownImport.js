const fs = require("fs");
const path = require("path");

const {
    importGodownGuids
} = require("./src/tally/godownGuidImportService");

(async () => {

    try {

        const godownGuids =
            await importGodownGuids({
                company: "Guru Kirpa Trading"
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
                    recursive: true
                }
            );

        }

        const filePath =
            path.join(
                logDir,
                "godownGuids.json"
            );

        fs.writeFileSync(
            filePath,
            JSON.stringify(
                godownGuids,
                null,
                2
            ),
            "utf8"
        );

        console.log(
            "Godown GUID JSON Generated:",
            filePath
        );

    }
    catch (error) {

        console.error(
            "Godown GUID Import Failed"
        );

        console.error(error);

    }

})();