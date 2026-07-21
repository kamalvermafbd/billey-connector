const fs = require("fs");

const {
    importVoucherTypes
} = require("./src/tally/voucherTypeImportService");

(async () => {

    const voucherTypes = await importVoucherTypes({

        company: "Sunil Ent(Client"

    });

    fs.writeFileSync(
        "./voucher-types-output.json",
        JSON.stringify(voucherTypes, null, 2),
        "utf8"
    );

    console.log("Voucher Types Imported.");

})();