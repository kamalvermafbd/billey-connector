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
connectServer();

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

    if (!company_code) {

        return res.status(400).json({
            success: false,
            error: "Company code required"
        });

    }

    saveConfig({
        company_code
    });

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