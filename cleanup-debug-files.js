const fs = require("fs");
const path = require("path");

// Project Root
const dir = __dirname;

const patterns = [

    // Generic Debug / Output Files
    /^.*-debug\.json$/,
    /^.*-debug\.txt$/,
    /^.*-output\.json$/,
    /^.*-output\.xml$/,
    /^.*-response\.json$/,
    /^.*-response\.xml$/,

    // Voucher Sync
    /^incoming-vouchers-.*\.json$/,

    // Integrity Validator
    /^integrity-entry-.*\.txt$/,
    /^integrity-exit-.*\.txt$/,
    /^integrity-error-.*\.txt$/,
    /^validator-start-.*\.txt$/,
    /^validator-end-.*\.txt$/,

    // Other Debug Files
    /^ledgerRows-before-insert-.*\.json$/

];

if (!fs.existsSync(dir)) {
    console.log("Folder not found:", dir);
    process.exit(0);
}

for (const file of fs.readdirSync(dir)) {

    if (patterns.some(regex => regex.test(file))) {

        try {

            fs.unlinkSync(path.join(dir, file));
            console.log("Deleted:", file);

        } catch (err) {

            console.error("Failed:", file, err.message);

        }

    }

}

console.log("✅ Debug cleanup completed.");