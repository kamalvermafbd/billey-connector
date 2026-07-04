const io = require("socket.io-client");

const config = require("../config/config");

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

    });

    socket.on("disconnect", () => {

        console.log("=================================");
        console.log("❌ Disconnected from Billey Server");
        console.log("=================================");

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