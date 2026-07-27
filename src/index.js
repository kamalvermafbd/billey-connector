const cors = require("cors");

const express = require("express");

const config = require("./config/config");

const { connectServer } = require("./socket/client");

const {
  getTallyCompanies,
  getTallyMappingData
} = require("./tally/tallyService");


const app = express();

app.use(cors());

app.use(express.json());

const PORT = 5001;

// Start Socket Connection
// Start Socket Connection
const socket = connectServer();

app.get("/", (req, res) => {
    res.send(config.CONNECTOR_NAME);
});

app.get("/test", (req, res) => {
    res.send("TEST OK");
});

app.get("/getTallyCompanies", async (req, res) => {

    try {

        const result =
            await getTallyCompanies();

        res.json(result);

    } catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,

            error:
                err.response?.data || err.message

        });

    }

});


const {
  buildVoucherRequestByGuid
} = require("./tally/voucherRequest");

const {
  sendToTally
} = require("./tally/tallyService");

app.get("/testGuid", async (req, res) => {

  try {

    const xml = buildVoucherRequestByGuid({
      company: req.query.company,
      voucherGuid: req.query.guid
    });

    const response = await sendToTally(xml);

    console.log(response.substring(0, 5000));

    res.send("Check console");

  } catch (err) {

    console.error(err);

    res.status(500).send(err.message);

  }

});

app.get("/getTallyMappingData", async (req, res) => {
   

  try {
 console.log(req.query);
    const result = await getTallyMappingData(
      req.query.company
    );

    res.json(result);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      error: err.response?.data || err.message
    });

  }

});

const { saveConfig } = require("./config/connectorConfig");

app.post("/pair", (req, res) => {

    const { company_code } = req.body;

    console.log("PAIR API HIT");
    console.log("PAIR COMPANY :", company_code);

    if (!company_code) {

        return res.status(400).json({
            success: false,
            error: "Company code required"
        });

    }

    saveConfig({
        company_code
    });

    socket.emit("register", {

    company_code,

    connector_version:
        config.CONNECTOR_VERSION,

    computer_name:
        require("os").hostname()

});
console.log("REGISTER EMITTED");

console.log("🔄 Connector Re-Registered :", company_code);

    res.json({
        success: true,
        message: "Connector paired successfully"
    });

});

app.listen(PORT, () => {

    console.log("=================================");
    console.log(config.CONNECTOR_NAME);
    console.log("Version :", config.CONNECTOR_VERSION);
    console.log("Running :", PORT);
    console.log("=================================");

});