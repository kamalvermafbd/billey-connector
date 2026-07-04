const fs = require("fs");
const path = require("path");

const os = require("os");

const CONFIG_DIR = path.join(

    os.homedir(),

    "AppData",

    "Roaming",

    "Billey Connector"

);

if (!fs.existsSync(CONFIG_DIR)) {

    fs.mkdirSync(CONFIG_DIR, {

        recursive: true

    });

}

const CONFIG_FILE = path.join(

    CONFIG_DIR,

    "connector.json"

);

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