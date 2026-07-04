const fs = require("fs");
const path = require("path");

const CONFIG_FILE = path.join(__dirname, "connector.json");

function loadConfig() {

    if (!fs.existsSync(CONFIG_FILE)) {

        return null;

    }

    return JSON.parse(
        fs.readFileSync(CONFIG_FILE, "utf8")
    );

}

function saveConfig(config) {

    fs.writeFileSync(
        CONFIG_FILE,
        JSON.stringify(config, null, 2)
    );

}

module.exports = {
    loadConfig,
    saveConfig
};