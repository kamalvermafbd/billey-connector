const express = require("express");

const config = require("./config/config");

const { connectServer } = require("./socket/client");

const app = express();

const PORT = 5001;

// Start Socket Connection
connectServer();

app.get("/", (req, res) => {
    res.send(config.CONNECTOR_NAME);
});

app.listen(PORT, () => {

    console.log("=================================");
    console.log(config.CONNECTOR_NAME);
    console.log("Version :", config.CONNECTOR_VERSION);
    console.log("Running :", PORT);
    console.log("=================================");

});