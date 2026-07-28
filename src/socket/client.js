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
    sendChunkedResponse
} = require("../../utils/sendChunkedResponse");

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

    socket.on("disconnect", (reason) => {

    console.log("=================================");
    console.log("❌ Disconnected from Billey Server");
    console.log("Reason :", reason);
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

        const result = await importMasters({
    company: data.company,
    lastAlterId: data.lastAlterId
});

        // ===========================
        // Debug Analysis
        // ===========================

        const collections = {
            groups: result.groups,
            units: result.units,
            ledgers: result.ledgers,
            stockGroups: result.stockGroups,
            stocks: result.stocks,
            godowns: result.godowns,
            costCentres: result.costCentres,
            vouchers: result.vouchers
        };

        console.log("========== RECORD COUNT ==========");

        for (const [name, value] of Object.entries(collections)) {

            console.log(
                `${name}:`,
                Array.isArray(value) ? value.length : 0
            );

        }

        console.log("========== PAYLOAD ANALYSIS ==========");

        for (const [name, value] of Object.entries(collections)) {

            const size = Buffer.byteLength(
                JSON.stringify(value || [])
            );

            console.log(
                `${name}: ${size} bytes (${(size / 1024).toFixed(2)} KB)`
            );

        }


        // ===========================
// Voucher Structure Analysis
// ===========================

if (result.vouchers && result.vouchers.length > 0) {

    const voucher = result.vouchers[0];

    console.log("========== FIRST VOUCHER KEYS ==========");
    console.log(Object.keys(voucher));

    console.log("========== FIRST VOUCHER FIELD SIZE ==========");

    for (const [key, value] of Object.entries(voucher)) {

        const size = Buffer.byteLength(
            JSON.stringify(value ?? null)
        );

        console.log(
            `${key}: ${(size / 1024).toFixed(2)} KB`
        );

    }

}
        // ===========================
        // Voucher Chunk Test
        // ===========================

/*
        const payload = {

            success: true,

            summary: result.summary,

            groups: result.groups,

            units: result.units,

            ledgers: result.ledgers,

            stockGroups: result.stockGroups,

            stocks: result.stocks,

            godowns: result.godowns,

            costCentres: result.costCentres,

            vouchers: voucherChunk

        };

        console.log(
            "Final Payload Size :",
            (
                Buffer.byteLength(
                    JSON.stringify(payload)
                ) / 1024
            ).toFixed(2),
            "KB"
        );

        socket.emit(
            "getMastersResult",
            payload
        );

        console.log("✅ getMastersResult Sent");

        */

        const masterPayload = {

    success: true,

    summary: result.summary,

     voucherCount: (result.vouchers || []).length,

    groups: result.groups,

    units: result.units,

    ledgers: result.ledgers,

    stockGroups: result.stockGroups,

    stocks: result.stocks,

    godowns: result.godowns,

    costCentres: result.costCentres

};

console.log(
    "Master Payload Size :",
    (
        Buffer.byteLength(
            JSON.stringify(masterPayload)
        ) / 1024
    ).toFixed(2),
    "KB"
);

// Send master data first
socket.emit(
    "getMastersResult",
    masterPayload
);

console.log("✅ Master data sent");

const vouchers = result.vouchers || [];

if (vouchers.length > 0) {

    await sendChunkedResponse(
        socket,
        "getMasters",
        vouchers
    );

    console.log("✅ Voucher chunks sent");

} else {

    console.log("No vouchers found");

}
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