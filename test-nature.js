const fs = require("fs");

const {
    testLedgerNature
} = require("./src/tally/reportService");

async function test() {

    try {

        const company = "Guru Kirpa Trading";

        console.log("================================");
        console.log("LEDGER NATURE TEST");
        console.log("COMPANY :", company);
        console.log("================================");

        const result = await testLedgerNature({
            company
        });

        fs.writeFileSync(
            "./ledger-nature-result.json",
            JSON.stringify(result, null, 2),
            "utf8"
        );

        console.log("================================");
        console.log("NATURE RESULT SAVED");
        console.log("================================");
        console.log("./ledger-nature-result.json");

    } catch (err) {

        console.error(
            "LEDGER NATURE TEST ERROR:",
            err
        );

    }

}

test();