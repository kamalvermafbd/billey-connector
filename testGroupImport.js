const fs = require("fs");
const path = require("path");

const {
    getGroups
} = require("./src/tally/tallyService");

(async () => {

    const company = "Guru Kirpa Trading";

    try {

        const groups =
            await getGroups(company);

        const result = {
            company,
            totalGroups: groups.length,
            groups
        };

        const filePath =
            path.join(
                __dirname,
                "src",
                "logs",
                "allGroupsTestResult.json"
            );

        fs.writeFileSync(
            filePath,
            JSON.stringify(
                result,
                null,
                2
            ),
            "utf8"
        );

        console.log(
            "TOTAL GROUPS:",
            groups.length
        );

        console.log(
            "Result:",
            filePath
        );

    } catch (err) {

        console.error(
            "GROUP TEST FAILED"
        );

        console.error(err);

    }

})();