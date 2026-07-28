const { sendToTally, selectCompany } = require("./src/tally/tallyService");
const { buildVoucherRequest } = require("./src/tally/voucherRequest");

const fs = require("fs");
const path = require("path");

async function test() {
    const company = "Sunil Ent (Client)";
    const lastAlterId = 211;

    // Logs folder bana do agar nahi hai
    fs.mkdirSync(path.join(__dirname, "logs"), { recursive: true });

    console.log("Selecting company...");
    await selectCompany(company);

    console.log("Building XML...");
    const requestXml = buildVoucherRequest({
    company,
    fromDate: "20260401",
    toDate: "20260430"
});

    fs.writeFileSync(
        path.join(__dirname, "logs", "request-alter.xml"),
        requestXml
    );

    console.log("Sending request to Tally...");
    const responseXml = await sendToTally(requestXml);

    fs.writeFileSync(
        path.join(__dirname, "logs", "response-alter.xml"),
        responseXml || ""
    );

    console.log("Response saved.");

    if (!responseXml) {
        console.log("No response received.");
        return;
    }

    // Agar error aaya ho to turant dikhe
    if (
        responseXml.includes("<LINEERROR>") ||
        responseXml.includes("<STATUS>0</STATUS>")
    ) {
        console.log("❌ Tally Error:");
        console.log(responseXml);
        return;
    }

    console.log("✅ Success");
    console.log(responseXml.substring(0, 1000)); // Pehle 1000 chars hi print karo
}

test().catch(console.error);