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





      const result = await importVouchers({
    company: "Sunil Ent(Client",
    fromDate: "20260301",
    toDate: "20270331",
   lookups: {
    ledgerLookup,
    partyLookup
}
});
       

        console.log("================================");
        console.log("Total Vouchers :", result.summary.totalVouchers);
        console.log("Files created successfully.");
        console.log("================================");

    } catch (err) {

        console.error("Voucher Import Failed");
        console.error(err);

    }

})();