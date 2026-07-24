const fs = require("fs");

const {
    importVoucherTypes
} = require("./src/tally/voucherTypeImportService");

(async () => {

    const voucherTypes = await importVoucherTypes({

        company: "Sunil Ent(Client"

    });

    

    console.log("Voucher Types Imported.");

})();