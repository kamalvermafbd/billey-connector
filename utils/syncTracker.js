const fs = require("fs");

const LOG_DIR = "./logs";
const LOG_FILE = "./logs/sync-tracking.json";

function ensureLogFile() {

    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    }

    if (!fs.existsSync(LOG_FILE)) {
        fs.writeFileSync(
            LOG_FILE,
            "[]",
            "utf8"
        );
    }
}

function trackSyncEvent({
    batchId = null,
    stage = null,
    progress = null,
    event = null,
    details = null
} = {}) {

    try {

        ensureLogFile();

        let logs = [];

        try {

            const raw =
                fs.readFileSync(
                    LOG_FILE,
                    "utf8"
                );

            logs = JSON.parse(raw);

            if (!Array.isArray(logs)) {
                logs = [];
            }

        } catch {

            logs = [];

        }

        logs.push({

            timestamp:
                new Date().toISOString(),

            batchId,

            event,

            stage,

            progress,

            details

        });

        fs.writeFileSync(

            LOG_FILE,

            JSON.stringify(
                logs,
                null,
                2
            ),

            "utf8"

        );

    } catch (err) {

        console.error(
            "❌ SYNC TRACKER ERROR:",
            err.message
        );

    }

}

module.exports = {
    trackSyncEvent,
    LOG_FILE
};