const fs = require("fs");
const path = require("path");

const {
    fetchTallyCollectionByMasterId
} = require("./src/tally/tallyService");

// ============================================================
// MASTER ID RANGE TEST LOG
// ============================================================

const logFile = path.join(
    __dirname,
    "src",
    "logs",
    "master-id-test.log"
);

// Fresh log for every test run
fs.writeFileSync(
    logFile,
    ""
);

function writeLog(message) {

    const line =
        `[${new Date().toISOString()}] ${message}\n`;

    fs.appendFileSync(
        logFile,
        line
    );

    console.log(message);
}

async function test() {

    const startId = 760;
    const endId = 1260;

    const companyName = "Guru Kirpa Trading";

    writeLog(
        "===================================="
    );

    writeLog(
        "MASTER ID RANGE TEST STARTED"
    );

    writeLog(
        `Tally Company: ${companyName}`
    );

    writeLog(
        "Collection: BilleyLedgerCollection"
    );

    writeLog(
        "Type: Ledger"
    );

    writeLog(
        `MasterID Range: ${startId} - ${endId}`
    );

    writeLog(
        "Calling Tally..."
    );

    const startedAt = Date.now();

    try {

        const result =
            await fetchTallyCollectionByMasterId({

                company: companyName,

                collectionName:
                    "BilleyLedgerCollection",

                collectionType:
                    "Ledger",

                startId,
                endId,

                fetchFields: [
                    "Name",
                    "Parent",
                    "MASTERID",
                    "ALTERID"
                ]

            });

        const durationMs =
            Date.now() - startedAt;

        const responseText =
            String(result || "");

        const responseBytes =
            Buffer.byteLength(
                responseText,
                "utf8"
            );

        writeLog(
            "========== TEST SUCCESS =========="
        );

        writeLog(
            `Duration MS: ${durationMs}`
        );

        writeLog(
            `Response Bytes: ${responseBytes}`
        );

        writeLog(
            `Response KB: ${Math.round(responseBytes / 1024)}`
        );

        writeLog(
            `Response Length: ${responseText.length}`
        );

        writeLog(
            "========== RESPONSE PREVIEW =========="
        );

        writeLog(
            responseText.substring(0, 2000)
        );

        writeLog(
            "===================================="
        );

    } catch (err) {

        const durationMs =
            Date.now() - startedAt;

        writeLog(
            "========== TEST FAILED =========="
        );

        writeLog(
            `Duration MS: ${durationMs}`
        );

        writeLog(
            `Error Name: ${err.name}`
        );

        writeLog(
            `Error Message: ${err.message}`
        );

        if (err.code) {

            writeLog(
                `Error Code: ${err.code}`
            );

        }

        if (err.response) {

            writeLog(
                `HTTP Status: ${err.response.status}`
            );

        }

        writeLog(
            err.stack || ""
        );

        writeLog(
            "===================================="
        );

    }
}

test();