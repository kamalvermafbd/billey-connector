const io = require("socket.io-client");
const os = require("os");
const config = require("../config/config");
const { loadConfig } = require("../config/connectorConfig");
const {
    sendToTally,
    getTallyCompanies,
    getTallyMappingData,
     getSalesVouchers
} = require("../tally/tallyService");

const {
    importMasters
} = require("../tally/importMasters");

const {
    getTrialBalance
} = require("../tally/reportService");


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

socket.on("getTallyCompanies", async () => {

    const result =
        await getTallyCompanies();

    socket.emit(
        "getTallyCompaniesResult",
        result
    );

});

socket.on("createUnitsInTally", async (data) => {

    const result =
        await sendToTally(
            data.xml
        );

    socket.emit(
        "createUnitsInTallyResult",
        result
    );

});

socket.on("createStocksInTally", async (data) => {

    const result =
        await sendToTally(
            data.xml
        );

    socket.emit(
        "createStocksInTallyResult",
        result
    );

});

socket.on("createTaxLedgersInTally", async (data) => {

    const result =
        await sendToTally(
            data.xml
        );

    socket.emit(
        "createTaxLedgersInTallyResult",
        result
    );

});

socket.on("createSalesLedgersInTally", async (data) => {

    const result =
        await sendToTally(
            data.xml
        );

    socket.emit(
        "createSalesLedgersInTallyResult",
        result
    );

});

socket.on("createDebtorsInTally", async (data) => {

    const result =
        await sendToTally(
            data.xml
        );

    socket.emit(
        "createDebtorsInTallyResult",
        result
    );

});

socket.on("exportSalesToTally", async (data) => {

    console.log("=================================");
    console.log("📦 SALES EXPORT RECEIVED");
    console.log("=================================");

    const result =
        await sendToTally(
            data.xml
        );

    console.log(
        "SALES EXPORT TALLY RESULT:",
        result
    );

    socket.emit(
        "exportSalesToTallyResult",
        result
    );

});

socket.on("pair", async (data) => {

    const {
        saveConfig
    } = require("../config/connectorConfig");

    saveConfig({

        company_code:
            data.company_code

    });

    socket.emit("register", {

        company_code:
            data.company_code,

        connector_version:
            config.CONNECTOR_VERSION,

        computer_name:
            os.hostname()

    });

    socket.emit(
        "pairResult",
        {
            success: true
        }
    );

});


socket.on("getTallyMappingData", async (data) => {

    const result =
        await getTallyMappingData(data.company);

    socket.emit(
        "getTallyMappingDataResult",
        result
    );

});

socket.on("getSalesVouchers", async (data) => {

    try {

        const result = await getSalesVouchers(data.company);

        socket.emit(
            "getSalesVouchersResult",
            result
        );

    } catch (err) {

        console.error("GET SALES VOUCHERS ERROR");
        console.error(err);

        socket.emit(
            "getSalesVouchersResult",
            {
                success: false,
                error: err.message
            }
        );

    }

});


socket.on("getMasters", async (data) => {

    try {

        const result =
            await importMasters({

                company:
                    data.company

            });

        socket.emit(
            "getMastersResult",
            {
                success: true,
                ...result
            }
        );

    } catch (err) {

        console.error("GET MASTERS ERROR");
        console.error(err);

        socket.emit(
            "getMastersResult",
            {
                success: false,
                error: err.message
            }
        );

    }

});

socket.on("getTrialBalance", async (data) => {

    try {

        const result =
            await getTrialBalance({
    company: data.company,
    asOnDate: data.asOnDate
});

        socket.emit(
            "getTrialBalanceResult",
            {
                success: true,
                data: result
            }
        );

    } catch (err) {

        socket.emit(
            "getTrialBalanceResult",
            {
                success: false,
                error: err.message
            }
        );

    }

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