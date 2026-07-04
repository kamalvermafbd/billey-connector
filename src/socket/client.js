const io = require("socket.io-client");
const os = require("os");
const config = require("../config/config");
const { loadConfig } = require("../config/connectorConfig");
const {
    getTallyMappingData
} = require("../tally/tallyService");

let socket = null;

function connectServer() {

    console.log("Connecting to Billey Server...");

    socket = io(config.SERVER_URL, {

        transports: ["websocket"],

        reconnection: true,

        reconnectionAttempts: Infinity,

        reconnectionDelay: 5000

    });

    socket.on("connect", () => {

        console.log("=================================");
        console.log("✅ Connected to Billey Server");
        console.log("Socket ID :", socket.id);
        console.log("=================================");

  const connectorConfig = loadConfig();

if (!connectorConfig) {

    console.log("❌ Connector not configured");

    return;

}

socket.emit("register", {

    company_code: connectorConfig.company_code,

    connector_version: config.CONNECTOR_VERSION,

    computer_name: os.hostname()

});

    socket.emit("testExport");

    });

    socket.on("disconnect", () => {

        console.log("=================================");
        console.log("❌ Disconnected from Billey Server");
        console.log("=================================");

    });

    socket.on("export", async (data) => {

    console.log("=================================");
    console.log("📦 Export Event Received");
    console.log(data);
    console.log("=================================");

});

socket.on("getTallyMappingData", async (data) => {

    const result =
        await getTallyMappingData(data.company);

    socket.emit(
        "getTallyMappingDataResult",
        result
    );

});



    socket.on("connect_error", (err) => {

        console.log("=================================");
        console.log("❌ Connection Failed");
        console.log(err.message);
        console.log("=================================");

    });

    return socket;
}

module.exports = {

    connectServer

};