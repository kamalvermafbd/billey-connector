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

const ConnectorProtocolController =
    require("../../utils/protocol/ConnectorProtocolController");

const {
    addChunk,
    isComplete,
    complete
} = require("../../utils/requestCollector");

const {
    importMasters
} = require("../tally/importMasters");


const {
    importVoucherGuids
} = require("../tally/voucherImportService");



const {
    importGroupGuids
} = require("../tally/groupGuidImportService");

const {
    importLedgerGuids
} = require("../tally/ledgerGuidImportService");


const {
    importStockGroupGuids
} = require("../tally/stockGroupGuidImportService");

const {
    importLedgerBulkByGuid
} = require("../tally/ledgerImportServiceBulkGuid");

const {
    importStockGuids
} = require("../tally/stockGuidImportService");

const {
    importUnitGuids
} = require("../tally/unitGuidImportService");

const {
    importGodownGuids
} = require("../tally/godownGuidImportService");

const {
    importCostCentreGuids
} = require("../tally/costCentreGuidImportService");

const {
    importVoucherBulkByGuid
} = require("../tally/voucherImportServiceBulkGuid");

const {
    importStockBulkByGuid
} = require("../tally/stockImportServiceBulkGuid");

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

    const protocolController =
    new ConnectorProtocolController(
        socket
    );

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

function sendProgress(stage) {

    socket.emit("getMastersProgress", {
        stage,
        timestamp: Date.now()
    });

}


socket.on("getMasters", async (data) => {

    try {

        const result = await importMasters({
            company: data.company,
            lastAlterId: data.lastAlterId,
            lastStockAlterId: data.lastStockAlterId,
            lastLedgerAlterId: data.lastLedgerAlterId
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

        

    const masterPayload = {

        success: true,

        summary: result.summary,

        voucherCount: (result.vouchers || []).length,
        voucherGuidCount: (result.voucherGuids || []).length,

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
/*
await sendChunkedResponse(
    socket,
    "getMastersGroups",
    result.groups || []
);

console.log("✅ Groups sent");

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
    

const vouchers = result.vouchers || [];

if (vouchers.length > 0) {

    await sendChunkedResponse(
        socket,
        "getMasters",
        vouchers
    );

    console.log("✅ Voucher chunks sent");

} else {

    console.log("No Incremental Vouchers Found");

    socket.emit(
        "getMastersComplete",
        {
            totalChunks: 0,
            totalItems: 0
        }
    );
}

*/

const masterPayload = {

    success: true,

    summary: result.summary,

    voucherCount:
        (result.vouchers || []).length,

    voucherGuidCount:
        (result.voucherGuids || []).length

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

socket.emit(
    "getMastersResult",
    masterPayload
);

console.log(
    "✅ Master payload sent"
);

await protocolController.sendMasters(
    result
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

socket.on("getMastersVoucherGuids", async (data) => {

    try {

        console.log("GUID REQUEST DATES:", {
            fromDate: data.fromDate,
            toDate: data.toDate
        });

       const voucherGuids =
        await importVoucherGuids({
            company: data.company,
            fromDate: data.fromDate,
            toDate: data.toDate,
            booksBeginningFrom: data.booksBeginningFrom,
            lastAlterId: data.lastAlterId,
            syncMode: data.syncMode,
            syncPeriod: data.syncPeriod
        });
        socket.emit(
            "getMastersVoucherGuidsResult",
            {
                success: true,
                collectionName: "voucherGuids",
                voucherGuidCount: voucherGuids.length
            }
        );

        if (voucherGuids.length > 0) {

            await sendChunkedResponse(
                socket,
                "getMastersVoucherGuids",
                voucherGuids
            );

            console.log(
                "✅ Voucher GUID chunks sent"
            );

       } else {

    console.log(
        "No voucher GUIDs found"
    );

    await sendChunkedResponse(
        socket,
        "getMastersVoucherGuids",
        []
    );

    console.log(
        "✅ Empty Voucher GUID collection completed"
    );
}

    } catch (err) {

        console.error(err);

        socket.emit(
            "getMastersVoucherGuidsResult",
            {
                success: false,
                error: err.message
            }
        );

    }

});



socket.on("getMastersGroupGuids", async (data) => {

    try {

        const groupGuids =
            await importGroupGuids({
                company: data.company
            });


        socket.emit(
            "getMastersGroupGuidsResult",
            {
                success: true,
                collectionName: "groupGuids",
                groupGuidCount: groupGuids.length
            }
        );


        if (groupGuids.length > 0) {

            await sendChunkedResponse(
                socket,
                "getMastersGroupGuids",
                groupGuids
            );

            console.log(
                "✅ Group GUID chunks sent"
            );

        } else {

    console.log(
        "No Group GUIDs found"
    );

    await sendChunkedResponse(
        socket,
        "getMastersGroupGuids",
        []
    );

    console.log(
        "✅ Empty Group GUID collection completed"
    );

}


    } catch (err) {

        console.error(err);

        socket.emit(
            "getMastersGroupGuidsResult",
            {
                success:false,
                error:err.message
            }
        );

    }

});

socket.on("getMastersLedgerGuids", async (data) => {

    try {

        const ledgerGuids =
            await importLedgerGuids({
                company: data.company
            });


        socket.emit(
            "getMastersLedgerGuidsResult",
            {
                success: true,
                collectionName: "ledgerGuids",
                ledgerGuidCount: ledgerGuids.length
            }
        );


        if (ledgerGuids.length > 0) {

            await sendChunkedResponse(
                socket,
                "getMastersLedgerGuids",
                ledgerGuids
            );

            console.log(
                "✅ Ledger GUID chunks sent"
            );

        } else {

    console.log(
        "No Ledger GUIDs found"
    );

    await sendChunkedResponse(
        socket,
        "getMastersLedgerGuids",
        []
    );

    console.log(
        "✅ Empty Ledger GUID collection completed"
    );

}

    } catch (err) {

        console.error(err);

        socket.emit(
            "getMastersLedgerGuidsResult",
            {
                success:false,
                error:err.message
            }
        );

    }

});



socket.on("getMastersStockGroupGuids", async (data) => {

    try {

        const stockGroupGuids =
            await importStockGroupGuids({
                company:data.company
            });


        socket.emit(
            "getMastersStockGroupGuidsResult",
            {
                success:true,
                collectionName:"stockGroupGuids",
                stockGroupGuidCount:stockGroupGuids.length
            }
        );


        await sendChunkedResponse(
            socket,
            "getMastersStockGroupGuids",
            stockGroupGuids
        );


    } catch(err){

        socket.emit(
            "getMastersStockGroupGuidsResult",
            {
                success:false,
                error:err.message
            }
        );

    }

});



socket.on("getMastersStockGuids", async (data) => {

    try {

        const stockGuids =
            await importStockGuids({
                company:data.company
            });


        socket.emit(
            "getMastersStockGuidsResult",
            {
                success:true,
                collectionName:"stockGuids",
                stockGuidCount:stockGuids.length
            }
        );


        await sendChunkedResponse(
            socket,
            "getMastersStockGuids",
            stockGuids
        );


    } catch(err){

        socket.emit(
            "getMastersStockGuidsResult",
            {
                success:false,
                error:err.message
            }
        );

    }

});



socket.on("getMastersUnitGuids", async (data) => {

    try {

        const unitGuids =
            await importUnitGuids({
                company:data.company
            });


        socket.emit(
            "getMastersUnitGuidsResult",
            {
                success:true,
                collectionName:"unitGuids",
                unitGuidCount:unitGuids.length
            }
        );


        await sendChunkedResponse(
            socket,
            "getMastersUnitGuids",
            unitGuids
        );


    } catch(err){

        socket.emit(
            "getMastersUnitGuidsResult",
            {
                success:false,
                error:err.message
            }
        );

    }

});



socket.on("getMastersGodownGuids", async (data) => {

    try {

        const godownGuids =
            await importGodownGuids({
                company:data.company
            });


        socket.emit(
            "getMastersGodownGuidsResult",
            {
                success:true,
                collectionName:"godownGuids",
                godownGuidCount:godownGuids.length
            }
        );


        await sendChunkedResponse(
            socket,
            "getMastersGodownGuids",
            godownGuids
        );


    } catch(err){

        socket.emit(
            "getMastersGodownGuidsResult",
            {
                success:false,
                error:err.message
            }
        );

    }

});



socket.on("getMastersCostCentreGuids", async (data) => {

    try {

        const costCentreGuids =
            await importCostCentreGuids({
                company:data.company
            });


        socket.emit(
            "getMastersCostCentreGuidsResult",
            {
                success:true,
                collectionName:"costCentreGuids",
                costCentreGuidCount:costCentreGuids.length
            }
        );


        await sendChunkedResponse(
            socket,
            "getMastersCostCentreGuids",
            costCentreGuids
        );


    } catch(err){

        socket.emit(
            "getMastersCostCentreGuidsResult",
            {
                success:false,
                error:err.message
            }
        );

    }

});

socket.on("voucherByGuidChunk", (data) => {

    try {

        addChunk(data);

        socket.emit("voucherByGuidChunkAck", {
            batchId: data.batchId,
            chunkIndex: data.chunkIndex,
            success: true
        });

        console.log(
            `Request Chunk ${data.chunkIndex}/${data.totalChunks} received`
        );

    } catch (err) {

        socket.emit("voucherByGuidChunkAck", {
            batchId: data.batchId,
            chunkIndex: data.chunkIndex,
            success: false,
            error: err.message
        });

    }

});

socket.on("stockByGuidChunk", (data) => {

    try {

        addChunk(data);

        socket.emit("stockByGuidChunkAck", {
            batchId: data.batchId,
            chunkIndex: data.chunkIndex,
            success: true
        });

        console.log(
            `Stock Request Chunk ${data.chunkIndex}/${data.totalChunks} received`
        );

    } catch (err) {

        socket.emit("stockByGuidChunkAck", {
            batchId: data.batchId,
            chunkIndex: data.chunkIndex,
            success: false,
            error: err.message
        });

    }

});

socket.on("stockByGuidComplete", async (data) => {

    try {

        if (!isComplete(data.batchId)) {

            throw new Error(
                "Missing stock request chunks"
            );

        }

        const stockGuids =
            complete(data.batchId);

        socket.emit(
        "stockByGuidCompleteAck",
                {
                    batchId: data.batchId,
                    success: true
                }
            );
        console.log(
            "Merged Stock GUIDs :",
            stockGuids.length
        );

        const stocks =
            await importStockBulkByGuid({

                company: data.company,

                stockGuids

            });

        socket.emit(
            "stockByGuidResult",
            {
                success: true,
                collectionName: "stocks",
                stockCount: stocks.length
            }
        );

        if (stocks.length > 0) {

            await sendChunkedResponse(
                socket,
                "stockByGuid",
                stocks
            );

            console.log(
                "✅ Missing Stock chunks sent"
            );

      } else {

    await sendChunkedResponse(
        socket,
        "stockByGuid",
        []
    );

    console.log(
        "✅ Empty Stock collection completed"
    );

}

    } catch (err) {

        console.error(
            "STOCK BY GUID ERROR",
            err
        );

        socket.emit(
            "stockByGuidResult",
            {
                success: false,
                error: err.message
            }
        );

    }

});

socket.on("ledgerByGuidChunk", (data) => {

    try {

        addChunk(data);

        socket.emit("ledgerByGuidChunkAck", {
            batchId: data.batchId,
            chunkIndex: data.chunkIndex,
            success: true
        });

    } catch (err) {

        socket.emit("ledgerByGuidChunkAck", {
            batchId: data.batchId,
            chunkIndex: data.chunkIndex,
            success: false,
            error: err.message
        });

    }

});


socket.on("ledgerByGuidComplete", async (data) => {

    try {

        if (!isComplete(data.batchId)) {

            throw new Error(
                "Missing ledger request chunks"
            );

        }

        const ledgerGuids =
            complete(data.batchId);

        socket.emit(
        "ledgerByGuidCompleteAck",
            {
                batchId: data.batchId,
                success: true
            }
        );

        console.log(
            "Merged Ledger GUIDs :",
            ledgerGuids.length
        );

        const ledgers =
            await importLedgerBulkByGuid({

                company: data.company,

                ledgerGuids

            });

        socket.emit(
            "ledgerByGuidResult",
            {
                success: true,
                collectionName: "ledgers",
                ledgerCount: ledgers.length
            }
        );

        if (ledgers.length > 0) {

            await sendChunkedResponse(
                socket,
                "ledgerByGuid",
                ledgers
            );

            console.log(
                "✅ Missing Ledger chunks sent"
            );

       } else {

    await sendChunkedResponse(
        socket,
        "ledgerByGuid",
        []
    );

    console.log(
        "✅ Empty Ledger collection completed"
    );

}

    } catch (err) {

        console.error(
            "LEDGER BY GUID ERROR",
            err
        );

        socket.emit(
            "ledgerByGuidResult",
            {
                success: false,
                error: err.message
            }
        );

    }

});


socket.on("voucherByGuidComplete", async (data) => {

    try {

        if (!isComplete(data.batchId)) {

            throw new Error(
                "Missing request chunks"
            );

        }

        const voucherGuids =
            complete(data.batchId);


        socket.emit(
            "voucherByGuidCompleteAck",
            {
                batchId: data.batchId,
                success: true
            }
        );

        console.log(
            "Merged GUIDs :",
            voucherGuids.length
        );

        const vouchers = await importVoucherBulkByGuid({

            company: data.company,

            voucherGuids

        });

socket.emit(
    "voucherByGuidResult",
    {
        success: true,
        collectionName: "vouchers",
        voucherCount: vouchers.length
    }
);

if (vouchers.length > 0) {

    await sendChunkedResponse(

        socket,

        "voucherByGuid",

        vouchers

    );

} else {

    await sendChunkedResponse(
        socket,
        "voucherByGuid",
        []
    );

}

        // Abhi sirf test
        console.log("✅ Request Chunking Working");

    } catch (err) {

        console.error(err);

    }

});


socket.on("voucherByGuid", async (data) => {

    try {

       const vouchers =
            await importVoucherBulkByGuid({

                company: data.company,

                voucherGuids: data.voucherGuids

            });

            socket.emit(
    "voucherByGuidResult",
    {
        success: true,
        collectionName: "vouchers",
        voucherCount: vouchers.length
    }
);

        if (vouchers.length > 0) {

            await sendChunkedResponse(

                socket,

                "voucherByGuid",

                vouchers

            );

            console.log(
                "✅ Missing Voucher chunks sent"
            );

        } else {

    await sendChunkedResponse(
        socket,
        "voucherByGuid",
        []
    );

}

    } catch (err) {

        console.error(err);

        socket.emit(
            "voucherByGuidResult",
            {
                success: false,
                error: err.message
            }
        );

    }

});

socket.on("stockByGuid", async (data) => {

    try {

        const stocks =
            await importStockBulkByGuid({

                company: data.company,

                stockGuids: data.stockGuids

            });

        socket.emit(
            "stockByGuidResult",
            {
                success: true,
                collectionName: "stocks",
                stockCount: stocks.length
            }
        );

        if (stocks.length > 0) {

            await sendChunkedResponse(

                socket,

                "stockByGuid",

                stocks

            );

            console.log(
                "✅ Missing Stock chunks sent"
            );

       } else {

    await sendChunkedResponse(
        socket,
        "stockByGuid",
        []
    );

}

    } catch (err) {

        console.error(err);

        socket.emit(
            "stockByGuidResult",
            {
                success: false,
                error: err.message
            }
        );

    }

});


socket.on("ledgerByGuid", async (data) => {

    try {

        const ledgers =
            await importLedgerBulkByGuid({

                company: data.company,

                ledgerGuids: data.ledgerGuids

            });

        socket.emit(
            "ledgerByGuidResult",
            {
                success: true,
                collectionName: "ledgers",
                ledgerCount: ledgers.length
            }
        );

        if (ledgers.length > 0) {

            await sendChunkedResponse(
                socket,
                "ledgerByGuid",
                ledgers
            );

       } else {

    await sendChunkedResponse(
        socket,
        "ledgerByGuid",
        []
    );

    console.log(
        "✅ Empty Ledger collection completed"
    );

}

    } catch (err) {

        console.error(err);

        socket.emit(
            "ledgerByGuidResult",
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