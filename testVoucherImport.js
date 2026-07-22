const fs = require("fs");

const { importVouchers } = require("./src/tally/voucherImportService");
const { importLedgers } = require("./src/tally/ledgerImportService");

(async () => {

    try {

        const ledgers = await importLedgers({
    company: "Sunil Ent(Client",
    booksBeginningFrom: "20260301"
});

const ledgerLookup = new Map(
    ledgers.map(l => [
        (l.name || "").toUpperCase(),
        l
    ])
);



fs.writeFileSync(
    "./ledgerLookup.json",
    JSON.stringify(
        [...ledgerLookup.entries()],
        null,
        2
    ),
    "utf8"
);

      const result = await importVouchers({
    company: "Sunil Ent(Client",
    fromDate: "20260301",
    toDate: "20270331",
   lookups: {
    ledgerLookup,
    partyLookup
}
});
        // Complete parsed output
        fs.writeFileSync(
            "./voucher-output.json",
            JSON.stringify(result.vouchers, null, 2),
            "utf8"
        );

        // Only inventory
        fs.writeFileSync(
            "./inventory-output.json",
            JSON.stringify(
                result.vouchers.map(v => v.inventory),
                null,
                2
            ),
            "utf8"
        );

        fs.writeFileSync(
    "./lookup-debug.json",
    JSON.stringify(
        global.lookupDebug || [],
        null,
        2
    ),
    "utf8"
);

        console.log("================================");
        console.log("Total Vouchers :", result.summary.totalVouchers);
        console.log("Files created successfully.");
        console.log("================================");

    } catch (err) {

        console.error("Voucher Import Failed");
        console.error(err);

    }

})();