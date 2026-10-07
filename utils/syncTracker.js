const fs = require("fs");

const LOG_FILE =
    "C:\\Users\\15FC0704AU\\Downloads\\connector\\logs\\sync-tracking.json";

function trackSyncEvent({
    batchId = null,
    stage = null,
    progress = null,
    event = null,
    details = null
} = {}) {
    try {
        const entry = {
            timestamp: new Date().toISOString(),
            batchId,
            event,
            stage,
            progress,
            details
        };

        fs.appendFileSync(
            LOG_FILE,
            JSON.stringify(entry) + "\n",
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