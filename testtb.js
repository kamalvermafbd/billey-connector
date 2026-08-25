const fs = require("fs");

const {
    getTrialBalance
} = require("./src/tally/reportService");

async function test() {

    try {

        const company =
            "Guru Kirpa Trading";

        console.log("================================");
        console.log("TRIAL BALANCE TEST");
        console.log("COMPANY :", company);
        console.log("FROM    : 01-08-2026");
        console.log("TILL    : 01-08-2026");
        console.log("================================");

        const result =
            await getTrialBalance({
                company
            });

        fs.writeFileSync(
            "./trial-balance-result.json",
            JSON.stringify(
                result,
                null,
                2
            ),
            "utf8"
        );

        console.log("================================");
        console.log("TRIAL BALANCE RESULT SAVED");
        console.log("================================");

        console.log(
            "./trial-balance-result.json"
        );

        console.log(
            "LEDGERS:",
            Array.isArray(result)
                ? result.length
                : "NOT ARRAY"
        );

    } catch (err) {

        console.error(
            "TRIAL BALANCE TEST ERROR:",
            err
        );

    }

}

test();