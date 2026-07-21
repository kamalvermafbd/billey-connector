const fs = require("fs");
const { importVouchers } = require("./src/tally/voucherImportService");

(async () => {

    const result = await importVouchers({

        company: "Sunil Ent(Client"

    });

    // Saare vouchers
    fs.writeFileSync(
        "./voucher-output.json",
        JSON.stringify(result.vouchers, null, 2),
        "utf8"
    );

    // Sirf pehle voucher ki inventory
  fs.writeFileSync(
    "./inventory-output.json",
    JSON.stringify(
        result.vouchers.map(v => v.inventory),
        null,
        2
    ),
    "utf8"
);

    console.log("Files created successfully.");

})();