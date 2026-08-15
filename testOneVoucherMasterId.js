const {
    fetchTallyCollectionByVoucherId
} = require("./src/tally/tallyService");

(async () => {

    const company =
        "Guru Kirpa Trading";

    const voucherId =
        11109;

    console.log("======================================");
    console.log("PRODUCTION TARGETED FETCH TEST");
    console.log("======================================");

    console.log("Company :", company);
    console.log("MasterID:", voucherId);

    try {

        const result =
            await fetchTallyCollectionByVoucherId({

                company,

                voucherId

            });

        console.log("");
        console.log("======================================");
        console.log("RESULT");
        console.log("======================================");

        console.log(
            "Response received:",
            !!result
        );

        console.log(
            "Response bytes:",
            Buffer.byteLength(
                String(result || ""),
                "utf8"
            )
        );

        console.log(
            "======================================"
        );

    } catch (err) {

        console.error(
            "TEST FAILED"
        );

        console.error(
            err.stack || err.message
        );

        process.exitCode = 1;

    }

})();