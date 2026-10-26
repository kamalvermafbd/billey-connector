const io = require("socket.io-client");
const os = require("os");
const config = require("../config/config");

const {
    trackSyncEvent
} = require("../../utils/syncTracker");



const {
    withTallyOperationQueue
} = require("../tally/tallyOperationQueue");

const {
    getTallyQueueStatus
} = require("../tally/tallyRequestQueue");

const {
    sendToTally,
    runWithTallyMonitor,
    getTallyCompanies,
    getTallyMappingData,
    getSalesVouchers
} = require("../tally/tallyService");

const {
    startTallyMonitor,
    stopTallyMonitor
} = require("./tallyMonitor");

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
    importCompany
} = require("../tally/companyImportService");

const {
    importStockSummary
} = require("../tally/stockSummaryImportService");

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
let identifiedCompanyGuids = [];

function connectServer() {

     console.log(
        "🔥 CONNECTSERVER CALLED",
        "PID:", process.pid,
        "TIME:", new Date().toISOString()
    );

    console.trace("CONNECTSERVER CALL STACK");

    console.log("Connecting to Billey Server...");

    console.log("SOCKET CONNECT TARGET :", config.SERVER_URL);
    socket = io(config.SERVER_URL, {

        transports: ["websocket"],

        reconnection: true,

        reconnectionAttempts: Infinity,

        reconnectionDelay: 5000

    });

    // Dedicated socket for Tally → Billey sync 141026
let syncSocket = null;
let syncProtocolController = null;

function connectSyncServer() {
    if (syncSocket) {
        return syncSocket;
    }

    const syncServerUrl = config.SECOND_SERVER_URL;

    if (!syncServerUrl) {
        console.error("❌ SYNC_SERVER_URL is not configured");
        return null;
    }

    syncSocket = io(syncServerUrl, {
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 5000
    });

    syncProtocolController =
        new ConnectorProtocolController(syncSocket);

    
syncSocket.on("connect", () => {
    console.log("✅ Connected to Second Sync Server", syncSocket.id);

    // Clear previous heartbeat timer on reconnect.
    if (syncSocket.heartbeatInterval) {
        clearInterval(syncSocket.heartbeatInterval);
    }

    // Immediate heartbeat so server receives a fresh timestamp.
    syncSocket.emit("protocol:heartbeat", {
        timestamp: Date.now()
    });

    // Keep second server heartbeat fresh.
    syncSocket.heartbeatInterval = setInterval(() => {
        if (syncSocket.connected) {
            syncSocket.emit("protocol:heartbeat", {
                timestamp: Date.now()
            });
        }
    }, 15000);

  if (socket.connected && identifiedCompanyGuids.length > 0) {
    const tallyQueueStatus = getTallyQueueStatus();

  syncSocket.emit("identifyConnector", {
    company_guids: identifiedCompanyGuids,
    tally_queue_status: tallyQueueStatus
});

    console.log(
        "IDENTIFY CONNECTOR SENT TO SYNC SERVER:",
        identifiedCompanyGuids.length,
        "TALLY QUEUE STATUS:",
        tallyQueueStatus
    );
}

        // Reconnect par latest verified Tally status bhejo.
    if (
        socket.connected &&
        (socket.tallyStatus === "ONLINE" ||
         socket.tallyStatus === "OFFLINE") &&
        Number.isFinite(socket.lastTallyStatusAt) &&
        Date.now() - socket.lastTallyStatusAt <= 15000
    ) {
        syncSocket.emit("tally:status", {
    status: socket.tallyStatus,
    company_guids: socket.tallyStatus === "ONLINE"
        ? identifiedCompanyGuids
        : [],
    timestamp: socket.lastTallyStatusAt
});
    }
});


    syncSocket.on("connect_error", (err) => {
        console.error(
            "❌ Second Sync Server connection error:",
            err.message
        );
    });

    syncSocket.on("disconnect", (reason) => {

    if (syncSocket.heartbeatInterval) {
        clearInterval(syncSocket.heartbeatInterval);
        syncSocket.heartbeatInterval = null;
    }

    console.log(
        "❌ Disconnected from Second Sync Server:",
        reason
    );
});

    return syncSocket;
}


connectSyncServer();


    socket.on("connect_error", (err) => {
    console.error("❌ SOCKET CONNECT ERROR");
    console.error("MESSAGE:", err.message);
    console.error("DESCRIPTION:", err.description);
    console.error("CONTEXT:", err.context);
});

    const protocolController =
    new ConnectorProtocolController(
        socket
    );

    /* 300826
    socket.on("connect", async () => {


        console.log("=================================");
        console.log("✅ Connected to Billey Server");
        console.log("Socket ID :", socket.id);
        console.log("=================================");

  const connectorConfig = loadConfig();

if (!connectorConfig) {

    console.log("❌ Connector not configured");

    return;

}


const tallyResult =
    await getTallyCompanies();

if (
    !tallyResult.success ||
    !tallyResult.companies?.length
) {

    console.log(
        "❌ Unable to identify Tally company"
    );

    return;

}

const tallyCompany =
    tallyResult.companies[0];

socket.emit("register", {

    company_code:
        connectorConfig.company_code,

    company_name:
        tallyCompany.name,

    company_guid:
        tallyCompany.guid,

    connector_version:
        config.CONNECTOR_VERSION,

    computer_name:
        os.hostname()

});

socket.emit("register", {

    company_code:
        connectorConfig.company_code,

    connector_version:
        config.CONNECTOR_VERSION,

    computer_name:
        os.hostname()

});


    socket.emit("testExport");

    });


*/

/*020926
socket.on("connect", async () => {

    console.log("=================================");
    console.log("✅ Connected to Billey Server");
    console.log("Socket ID :", socket.id);
    console.log("=================================");

    const connectorConfig = loadConfig();

    if (!connectorConfig) {

        console.log(
            "🆕 New connector - waiting for pairing"
        );

        return;

    }


  

    const tallyResult =
        await getTallyCompanies();

    if (
        !tallyResult.success ||
        !tallyResult.companies?.length
    ) {

        console.log(
            "❌ Unable to identify Tally company"
        );

        return;

    }

    const tallyCompany =
        tallyResult.companies[0];

    socket.emit("register", {

        company_code:
            connectorConfig.company_code,

        company_name:
            tallyCompany.name,

        company_guid:
            tallyCompany.guid,

          connector_id:
        connectorConfig.connector_id,

        connector_version:
            config.CONNECTOR_VERSION,

        computer_name:
            os.hostname()

    });

});

*/

socket.on("connect", async () => {

    // Fresh Tally verification is required after every connection.
socket.tallyStatus = "OFFLINE";
socket.lastTallyStatusAt = 0;

// Do not reuse company GUIDs from the previous connection.
identifiedCompanyGuids = [];

    if (socket.heartbeatInterval) clearInterval(socket.heartbeatInterval);

// Send heartbeat immediately after connection.
socket.emit("protocol:heartbeat", {
    timestamp: Date.now()
});

socket.heartbeatInterval = setInterval(() => {
    if (socket.connected) {
        socket.emit("protocol:heartbeat", { timestamp: Date.now() });
    }
}, 15000);

    console.log("================================");
    console.log("Connected to Billey Server");
    console.log("Socket ID :", socket.id);
    console.log("================================");

      try {

        console.log("🔎 STARTING TALLY COMPANY IDENTIFICATION");

        const tallyResult =
    await withTallyOperationQueue(() =>
        getTallyCompanies()
    );
        console.log("🔎 TALLY COMPANY IDENTIFICATION RESULT RECEIVED");

        if (
            !tallyResult.success ||
            !tallyResult.companies?.length
        ) {

            console.log(
                "❌ Unable to identify Tally companies"
            );

            return;

        }

        const company_guids =
            tallyResult.companies
                .map(company => company.guid)
                .filter(Boolean);

        console.log(
            "IDENTIFY CONNECTOR GUIDS:",
            company_guids
        );

        identifiedCompanyGuids = company_guids;

socket.emit(
    "identifyConnector",
    {
        company_guids
    }
);

// Register on sync server when its socket is connected
if (syncSocket && syncSocket.connected) {
    syncSocket.emit("identifyConnector", {
        company_guids,
        tally_queue_status: getTallyQueueStatus()
    });
}


 
    } catch (err) {
        console.error(
            "❌ CONNECTOR IDENTIFICATION ERROR:",
            err
        );
   } finally {
    // Forwarding pehle install karo.
    if (!socket.tallyStatusForwardingInstalled) {
        socket.tallyStatusForwardingInstalled = true;

        const originalEmit = socket.emit.bind(socket);

       socket.emit = function (event, ...args) {
    if (event === "tally:status") {
        const data = args[0];

      if (data?.status === "ONLINE" || data?.status === "OFFLINE") {
    socket.tallyStatus = data.status;
    socket.lastTallyStatusAt = Date.now();

    if (data.status === "ONLINE" && Array.isArray(data.company_guids)) {
    const latestGuids = [...new Set(data.company_guids.filter(Boolean))].sort();
    const previousGuids = [...identifiedCompanyGuids].sort();

    if (
        latestGuids.length > 0 &&
        JSON.stringify(latestGuids) !== JSON.stringify(previousGuids)
    ) {
        identifiedCompanyGuids = latestGuids;

          if (syncSocket?.connected) {
    syncSocket.emit("identifyConnector", {
        company_guids: latestGuids,
        tally_queue_status: getTallyQueueStatus()
    });
}
        }
    }
}

        if (syncSocket?.connected) {
            syncSocket.emit("tally:status", ...args);
        }
    }

    return originalEmit(event, ...args);
};
    }

    // Existing monitor sirf ek baar start hoga.
    startTallyMonitor(socket);
}
});



socket.on("disconnect", (reason) => {

    if (socket.heartbeatInterval) {
    clearInterval(socket.heartbeatInterval);
    socket.heartbeatInterval = null;
}

    stopTallyMonitor(socket);

        // Main connection lost: cached Tally status is no longer fresh.
    socket.tallyStatus = "OFFLINE";
    socket.lastTallyStatusAt = 0;

    // Inform second sync server immediately when main connection is lost.
if (syncSocket?.connected) {
    syncSocket.emit("tally:status", {
        status: "OFFLINE",
        company_guids: [],
        timestamp: Date.now()
    });
}

    // Require fresh Tally company identification after reconnect.
identifiedCompanyGuids = [];

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

    try {

        console.log("=================================");
        console.log("📋 GET TALLY COMPANIES REQUEST");
        console.log("=================================");

       const result =
    await withTallyOperationQueue(() =>
        getTallyCompanies()
    );

        console.log(
            "TALLY COMPANIES RESULT:",
            result
        );

        socket.emit(
            "getTallyCompaniesResult",
            result
        );

    } catch (err) {

        console.error(
            "❌ GET TALLY COMPANIES ERROR:",
            err
        );

        socket.emit(
            "getTallyCompaniesResult",
            {
                success: false,
                error: err.message
            }
        );

    }

});

socket.on("getTallyCompanyInfo", async (data) => {

    try {

        const result = await withTallyOperationQueue(() =>
    importCompany({
        company: data.company
    })
);

        socket.emit(
            "getTallyCompanyInfoResult",
            result
        );

    } catch (err) {

        console.error(
            "GET TALLY COMPANY INFO ERROR:",
            err
        );

        socket.emit(
            "getTallyCompanyInfoResult",
            {
                success: false,
                error: err.message
            }
        );

    }

});

socket.on("createUnitsInTally", async (data) => {

   const result =
    await withTallyOperationQueue(() =>
        sendToTally(data.xml)
    );

    socket.emit(
        "createUnitsInTallyResult",
        result
    );

});

socket.on("createStocksInTally", async (data) => {

   const result =
    await withTallyOperationQueue(() =>
        sendToTally(data.xml)
    );
    socket.emit(
        "createStocksInTallyResult",
        result
    );

});

socket.on("createTaxLedgersInTally", async (data) => {

  const result =
    await withTallyOperationQueue(() =>
        sendToTally(data.xml)
    );

    socket.emit(
        "createTaxLedgersInTallyResult",
        result
    );

});

socket.on("createSalesLedgersInTally", async (data) => {

    const result =
    await withTallyOperationQueue(() =>
        sendToTally(data.xml)
    );

    socket.emit(
        "createSalesLedgersInTallyResult",
        result
    );

});

socket.on("createDebtorsInTally", async (data) => {

   const result =
    await withTallyOperationQueue(() =>
        sendToTally(data.xml)
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
    await withTallyOperationQueue(() =>
        sendToTally(data.xml)
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

    socket.connectorId =
        data.connector_id;

    socket.emit("register", {

        company_code:
            data.company_code,

        company_name:
            data.company_name,

        company_guid:
            data.company_guid,

        connector_id:
            data.connector_id,

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
    await withTallyOperationQueue(() =>
        getTallyMappingData(data.company)
    );

    socket.emit(
        "getTallyMappingDataResult",
        result
    );

});

socket.on("getSalesVouchers", async (data) => {

    try {

        const result = await withTallyOperationQueue(() =>
    getSalesVouchers(data.company)
);

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


function sendProgress(stage, progress, batchId) {

    console.log("📊 PROGRESS:", {
        stage,
        progress,
        batchId
    });

    trackSyncEvent({
        batchId,
        stage,
        progress,
        event: "SYNC_PROGRESS"
    });

    syncSocket.emit("getMastersProgress", {
        stage,
        progress,
        batchId,
        timestamp: Date.now()
    });
}

// ==========================================
// STOCK GODOWN SUMMARY
// ==========================================
if (syncSocket) {
syncSocket.on("getStockGodownSummary", async (data) => {

    try {

        console.log("=================================");
        console.log("📦 STOCK GODOWN SUMMARY REQUEST");
        console.log("=================================");

        console.log(
            "Company :",
            data.company
        );

        console.log(
            "Books Beginning From :",
            data.booksBeginningFrom
        );


        // ======================================
        // IMPORT GODOWN-WISE STOCK FROM TALLY
        // ======================================

      const stockGodownSummary =
    await withTallyOperationQueue(() =>
        importStockSummary({
            company: data.company,
            booksBeginningFrom: data.booksBeginningFrom
        })
    );


        const stockGodownRows =
            stockGodownSummary.data || [];


        console.log(
            "Godown-wise stock rows :",
            stockGodownRows.length
        );


        // ======================================
        // SEND RESULT COUNT
        // ======================================

    syncSocket.emit(
    "getStockGodownSummaryResult",
    {
        requestId: data.requestId,
        success: true,

        collectionName:
            "stockGodownBalances",

        stockGodownCount:
            stockGodownRows.length
    }
);


        // ======================================
        // SEND THROUGH EXISTING
        // MASTER PROTOCOL CHUNK SYSTEM
        // ======================================

        await syncProtocolController.sendStockGodownSummary(
            stockGodownRows,
            data.requestId
        );

        console.log(
            "✅ Stock Godown Summary sent through protocol"
        );


    } catch (err) {

        console.error(
            "STOCK GODOWN SUMMARY ERROR"
        );

        console.error(err);


      syncSocket.emit(
    "getStockGodownSummaryResult",
    {
        requestId: data?.requestId,
        success: false,
        error: err.message
    }
);

    }

});


syncSocket.on("getMasters", async (data) => {

    try {

        // MONITORING ONLY
        syncSocket.tallyOperationActive = true;
        syncSocket.lastTallyActivity = Date.now();

        const result = await withTallyOperationQueue(() =>
    runWithTallyMonitor({

           onTallyRequestStart: () => {
                syncSocket.tallyRequestActive = true;
                syncSocket.tallyRequestStartedAt = Date.now();
                syncSocket.lastTallyActivity = Date.now();

                syncSocket.emit("tally:request:start", {
                    batchId: data.batchId,
                    timestamp: syncSocket.tallyRequestStartedAt
                });
            },

           onTallyRequestEnd: () => {
    syncSocket.tallyRequestActive = false;
    syncSocket.tallyRequestStartedAt = 0;
    syncSocket.lastTallyActivity = Date.now();

    syncSocket.emit("tally:request:end", {
        batchId: data.batchId,
        timestamp: Date.now()
    });
},

         onTallyRequestError: (err) => {
    syncSocket.tallyRequestActive = false;
    syncSocket.tallyRequestStartedAt = 0;
    syncSocket.lastTallyActivity = Date.now();

    const tallyErrorCode =
        err?.code ||
        err?.cause?.code ||
        "";

    const isTallyOffline =
        tallyErrorCode === "ECONNREFUSED" ||
        tallyErrorCode === "ECONNRESET" ||
        err?.message === "socket hang up";

    syncSocket.emit("tally:request:error", {
        batchId: data.batchId,
        timestamp: Date.now(),
        error: isTallyOffline
            ? "TALLY_OFFLINE"
            : (tallyErrorCode || err?.message || "TALLY_REQUEST_ERROR")
    });
},

        }, async () => {

            return await importMasters({
                company: data.company,
                lastAlterId: data.lastAlterId,
                lastStockAlterId: data.lastStockAlterId,
                lastLedgerAlterId: data.lastLedgerAlterId,

                onProgress: (progressData) => {
                    sendProgress(
                        progressData.stage,
                        progressData.progress,
                        data.batchId
                    );
                }
            });

        })
   );
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

    requestId: data.requestId,

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

syncSocket.emit(
    "getMastersResult",
    masterPayload
);


console.log(
    "✅ Master payload sent"
);


await syncProtocolController.sendMasters(
    result,
    data.requestId
);

// MONITORING ONLY

syncSocket.tallyOperationActive = false;
syncSocket.lastTallyActivity = Date.now();


   } catch (err) {

    
syncSocket.tallyOperationActive = false;
syncSocket.tallyRequestActive = false;
syncSocket.tallyRequestStartedAt = 0;


    console.error("GET MASTERS ERROR");
    console.error(err);

    const tallyErrorCode =
        err?.code ||
        err?.cause?.code ||
        "";

    const isTallyOffline =
        tallyErrorCode === "ECONNREFUSED" ||
        tallyErrorCode === "ECONNRESET" ||
        err?.message === "socket hang up";

    
syncSocket.emit(
    "getMastersResult",
    {
        requestId: data?.requestId,
        success: false,
        error: isTallyOffline
            ? "TALLY_OFFLINE"
            : err.message
    }
);

}

});
syncSocket.on("getMastersVoucherGuids", async (data) => {

    try {

        sendProgress(
            "VOUCHER_GUID_DISCOVERY",
            null,
            data.batchId
        );

        console.log("GUID REQUEST DATES:", {
            fromDate: data.fromDate,
            toDate: data.toDate
        });

        console.log("=== GUID REQUEST DEBUG ===");

        console.log({
            company: data.company,
            fromDate: data.fromDate,
            toDate: data.toDate,
            booksBeginningFrom: data.booksBeginningFrom,
            lastAlterId: data.lastAlterId,
            syncMode: data.syncMode,
            syncPeriod: data.syncPeriod
        });

     const voucherGuids =
    await withTallyOperationQueue(() =>
        importVoucherGuids({
            company: data.company,
            fromDate: data.fromDate,
            toDate: data.toDate,
            booksBeginningFrom: data.booksBeginningFrom,
            lastAlterId: data.lastAlterId,
            syncMode: data.syncMode,
            syncPeriod: data.syncPeriod
        })
    );
        sendProgress(
            "VOUCHER_GUIDS_RECEIVED",
            null,
            data.batchId
        );

        console.log(
            "VOUCHER GUIDS RECEIVED FROM TALLY:",
            voucherGuids.length
        );

        console.log("=== END GUID REQUEST DEBUG ===");

        // =====================================
        // SEND RESULT WITH REQUEST ID
        // =====================================

        syncSocket.emit(
            "getMastersVoucherGuidsResult",
            {
                requestId: data.requestId,
                success: true,
                collectionName: "voucherGuids",
                voucherGuidCount: voucherGuids.length
            }
        );

        // =====================================
        // SEND VOUCHER GUID CHUNKS
        // =====================================

        if (voucherGuids.length > 0) {

            sendProgress(
                "VOUCHER_CHUNK_SEND",
                null,
                data.batchId
            );

            await sendChunkedResponse(
                syncSocket,
                "getMastersVoucherGuids",
                voucherGuids,
                undefined,
                data.requestId
            );

            console.log(
                "✅ Voucher GUID chunks sent"
            );

        } else {

            console.log(
                "No voucher GUIDs found"
            );

            sendProgress(
                "VOUCHER_CHUNK_SEND",
                null,
                data.batchId
            );

            await sendChunkedResponse(
                syncSocket,
                "getMastersVoucherGuids",
                [],
                undefined,
                data.requestId
            );

            console.log(
                "✅ Empty Voucher GUID collection completed"
            );
        }

    } catch (err) {

        console.error(
            "GET MASTERS VOUCHER GUIDS ERROR:",
            err
        );

        syncSocket.emit(
            "getMastersVoucherGuidsResult",
            {
                requestId: data?.requestId,
                success: false,
                error: err.message
            }
        );

    }

});

syncSocket.on("getMastersGroupGuids", async (data) => {

    try {

        const groupGuids =
    await withTallyOperationQueue(() =>
        importGroupGuids({
            company: data.company
        })
    );
        syncSocket.emit(
            "getMastersGroupGuidsResult",
            {
                requestId: data.requestId,
                success: true,
                collectionName: "groupGuids",
                groupGuidCount: groupGuids.length
            }
        );

        if (groupGuids.length > 0) {

            await sendChunkedResponse(
                syncSocket,
                "getMastersGroupGuids",
                groupGuids,
                undefined,
                data.requestId
            );

            console.log(
                "✅ Group GUID chunks sent"
            );

        } else {

            console.log(
                "No Group GUIDs found"
            );

            await sendChunkedResponse(
                syncSocket,
                "getMastersGroupGuids",
                [],
                undefined,
                data.requestId
            );

            console.log(
                "✅ Empty Group GUID collection completed"
            );

        }

    } catch (err) {

        console.error(err);

        syncSocket.emit(
            "getMastersGroupGuidsResult",
            {
                requestId: data?.requestId,
                success: false,
                error: err.message
            }
        );

    }

});


syncSocket.on("getMastersLedgerGuids", async (data) => {

    try {

        const ledgerGuids =
    await withTallyOperationQueue(() =>
        importLedgerGuids({
            company: data.company
        })
    );

        syncSocket.emit(
            "getMastersLedgerGuidsResult",
            {
                requestId: data.requestId,
                success: true,
                collectionName: "ledgerGuids",
                ledgerGuidCount: ledgerGuids.length
            }
        );

        if (ledgerGuids.length > 0) {

            await sendChunkedResponse(
                syncSocket,
                "getMastersLedgerGuids",
                ledgerGuids,
                undefined,
                data.requestId
            );

            console.log(
                "✅ Ledger GUID chunks sent"
            );

        } else {

            console.log(
                "No Ledger GUIDs found"
            );

            await sendChunkedResponse(
                syncSocket,
                "getMastersLedgerGuids",
                [],
                undefined,
                data.requestId
            );

            console.log(
                "✅ Empty Ledger GUID collection completed"
            );

        }

    } catch (err) {

        console.error(err);

        syncSocket.emit(
            "getMastersLedgerGuidsResult",
            {
                requestId: data?.requestId,
                success: false,
                error: err.message
            }
        );

    }

});



syncSocket.on("getMastersStockGroupGuids", async (data) => {

    try {

        const stockGroupGuids =
    await withTallyOperationQueue(() =>
        importStockGroupGuids({
            company: data.company
        })
    );

        syncSocket.emit(
            "getMastersStockGroupGuidsResult",
            {
                requestId: data.requestId,
                success: true,
                collectionName: "stockGroupGuids",
                stockGroupGuidCount: stockGroupGuids.length
            }
        );

        await sendChunkedResponse(
            syncSocket,
            "getMastersStockGroupGuids",
            stockGroupGuids,
            undefined,
            data.requestId
        );

    } catch (err) {

        console.error(err);

        syncSocket.emit(
            "getMastersStockGroupGuidsResult",
            {
                requestId: data?.requestId,
                success: false,
                error: err.message
            }
        );

    }

});

syncSocket.on("getMastersStockGuids", async (data) => {

    try {

        const stockGuids =
    await withTallyOperationQueue(() =>
        importStockGuids({
            company: data.company
        })
    );
        syncSocket.emit(
            "getMastersStockGuidsResult",
            {
                requestId: data.requestId,
                success: true,
                collectionName: "stockGuids",
                stockGuidCount: stockGuids.length
            }
        );

        await sendChunkedResponse(
            syncSocket,
            "getMastersStockGuids",
            stockGuids,
            undefined,
            data.requestId
        );

    } catch (err) {

        console.error(err);

        syncSocket.emit(
            "getMastersStockGuidsResult",
            {
                requestId: data?.requestId,
                success: false,
                error: err.message
            }
        );

    }

});


syncSocket.on("getMastersUnitGuids", async (data) => {

    try {

        const unitGuids =
    await withTallyOperationQueue(() =>
        importUnitGuids({
            company: data.company
        })
    );
        syncSocket.emit(
            "getMastersUnitGuidsResult",
            {
                requestId: data.requestId,
                success: true,
                collectionName: "unitGuids",
                unitGuidCount: unitGuids.length
            }
        );

        await sendChunkedResponse(
            syncSocket,
            "getMastersUnitGuids",
            unitGuids,
            undefined,
            data.requestId
        );

    } catch (err) {

        console.error(err);

        syncSocket.emit(
            "getMastersUnitGuidsResult",
            {
                requestId: data?.requestId,
                success: false,
                error: err.message
            }
        );

    }

});



syncSocket.on("getMastersGodownGuids", async (data) => {

    try {

        const godownGuids =
    await withTallyOperationQueue(() =>
        importGodownGuids({
            company: data.company
        })
    );

        syncSocket.emit(
            "getMastersGodownGuidsResult",
            {
                requestId: data.requestId,
                success: true,
                collectionName: "godownGuids",
                godownGuidCount: godownGuids.length
            }
        );

        await sendChunkedResponse(
            syncSocket,
            "getMastersGodownGuids",
            godownGuids,
            undefined,
            data.requestId
        );

    } catch (err) {

        console.error(err);

        syncSocket.emit(
            "getMastersGodownGuidsResult",
            {
                requestId: data?.requestId,
                success: false,
                error: err.message
            }
        );

    }

});



syncSocket.on("getMastersCostCentreGuids", async (data) => {

    try {

        const costCentreGuids =
    await withTallyOperationQueue(() =>
        importCostCentreGuids({
            company: data.company
        })
    );
        syncSocket.emit(
            "getMastersCostCentreGuidsResult",
            {
                requestId: data.requestId,
                success: true,
                collectionName: "costCentreGuids",
                costCentreGuidCount: costCentreGuids.length
            }
        );

        await sendChunkedResponse(
            syncSocket,
            "getMastersCostCentreGuids",
            costCentreGuids,
            undefined,
            data.requestId
        );

    } catch (err) {

        console.error(err);

        syncSocket.emit(
            "getMastersCostCentreGuidsResult",
            {
                requestId: data?.requestId,
                success: false,
                error: err.message
            }
        );

    }

});


syncSocket.on("voucherByGuidChunk", (data) => {

    try {

        sendProgress(
            "VOUCHER_CHUNK_RECEIVE",
            null,
            data.batchId
        );

        addChunk(data);

        syncSocket.emit("voucherByGuidChunkAck", {
            batchId: data.batchId,
            requestId: data.requestId,
            chunkIndex: data.chunkIndex,
            success: true
        });

        console.log(
            `Request Chunk ${data.chunkIndex}/${data.totalChunks} received`
        );

    } catch (err) {

        console.error(err);

        syncSocket.emit("voucherByGuidChunkAck", {
            batchId: data.batchId,
            requestId: data.requestId,
            chunkIndex: data.chunkIndex,
            success: false,
            error: err.message
        });

    }

});


syncSocket.on("stockByGuidChunk", (data) => {

    try {

        addChunk(data);

        syncSocket.emit("stockByGuidChunkAck", {
    batchId: data.batchId,
    requestId: data.requestId,
    chunkIndex: data.chunkIndex,
    success: true
});

        console.log(
            `Stock Request Chunk ${data.chunkIndex}/${data.totalChunks} received`
        );

    } catch (err) {

        console.error(err);

       syncSocket.emit("stockByGuidChunkAck", {
    batchId: data.batchId,
    requestId: data.requestId,
    chunkIndex: data.chunkIndex,
    success: false,
    error: err.message
});

    }

});



syncSocket.on("stockByGuidComplete", async (data) => {

    try {

        if (!isComplete(data.batchId)) {

            throw new Error(
                "Missing stock request chunks"
            );

        }

        const stockGuids =
            complete(data.batchId);

       syncSocket.emit(
    "stockByGuidCompleteAck",
    {
        batchId: data.batchId,
        requestId: data.requestId,
        success: true
    }
);

        console.log(
            "Merged Stock GUIDs :",
            stockGuids.length
        );

        const stocks =
    await withTallyOperationQueue(() =>
        importStockBulkByGuid({
            company: data.company,
            stockGuids
        })
    );

       syncSocket.emit(
    "stockByGuidResult",
    {
        requestId: data.requestId,
        success: true,
        collectionName: "stocks",
        stockCount: stocks.length
    }
);

        if (stocks.length > 0) {

            await sendChunkedResponse(
    syncSocket,
    "stockByGuid",
    stocks,
    undefined,
    data.requestId
);
            console.log(
                "✅ Missing Stock chunks sent"
            );

        } else {

            await sendChunkedResponse(
    syncSocket,
    "stockByGuid",
    [],
    undefined,
    data.requestId
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

       syncSocket.emit(
    "stockByGuidResult",
    {
        requestId: data?.requestId,
        success: false,
        error: err.message
    }
);

    }

});


syncSocket.on("ledgerByGuidChunk", (data) => {

    try {

        addChunk(data);

        syncSocket.emit("ledgerByGuidChunkAck", {
    batchId: data.batchId,
    requestId: data.requestId,
    chunkIndex: data.chunkIndex,
    success: true
});

    } catch (err) {

        console.error(err);

       syncSocket.emit("ledgerByGuidChunkAck", {
    batchId: data.batchId,
    requestId: data.requestId,
    chunkIndex: data.chunkIndex,
    success: false,
    error: err.message
});

    }

});



syncSocket.on("ledgerByGuidComplete", async (data) => {

    try {

        if (!isComplete(data.batchId)) {

            throw new Error(
                "Missing ledger request chunks"
            );

        }

        const ledgerGuids =
            complete(data.batchId);

        syncSocket.emit(
    "ledgerByGuidCompleteAck",
    {
        batchId: data.batchId,
        requestId: data.requestId,
        success: true
    }
);

        console.log(
            "Merged Ledger GUIDs :",
            ledgerGuids.length
        );

        const ledgers =
    await withTallyOperationQueue(() =>
        importLedgerBulkByGuid({
            company: data.company,
            ledgerGuids
        })
    );

       syncSocket.emit(
    "ledgerByGuidResult",
    {
        requestId: data.requestId,
        success: true,
        collectionName: "ledgers",
        ledgerCount: ledgers.length
    }
);

        if (ledgers.length > 0) {

    await sendChunkedResponse(
        syncSocket,
        "ledgerByGuid",
        ledgers,
        undefined,
        data.requestId
    );

    console.log(
        "✅ Missing Ledger chunks sent"
    );

}else {

          await sendChunkedResponse(
    syncSocket,
    "ledgerByGuid",
    [],
    undefined,
    data.requestId
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

    syncSocket.emit(
    "ledgerByGuidResult",
    {
        requestId: data?.requestId,
        success: false,
        error: err.message
    }
);

    }

});



syncSocket.on("voucherByGuidComplete", async (data) => {

    try {

        if (!isComplete(data.batchId)) {

            throw new Error(
                "Missing request chunks"
            );

        }

        const voucherGuids =
            complete(data.batchId);

        sendProgress(
            "VOUCHER_IMPORT",
            null,
            data.batchId
        );

        console.log(
            "BULK GUID INPUT:",
            voucherGuids
        );

       syncSocket.emit(
    "voucherByGuidCompleteAck",
    {
        batchId: data.batchId,
        requestId: data.requestId,
        success: true
    }
);

        console.log(
            "Merged GUIDs :",
            voucherGuids.length
        );

        const vouchers =
    await withTallyOperationQueue(() =>
        importVoucherBulkByGuid({
            company: data.company,
            voucherGuids
        })
    );

       syncSocket.emit(
    "voucherByGuidResult",
            {
                requestId: data.requestId,
                success: true,
                collectionName: "vouchers",
                voucherCount: vouchers.length
            }
        );

        if (vouchers.length > 0) {

            sendProgress(
                "VOUCHER_CHUNK_SEND",
                null,
                data.batchId
            );

            await sendChunkedResponse(
                syncSocket,
                "voucherByGuid",
                vouchers,
                undefined,
                data.requestId
            );

        } else {

            sendProgress(
                "VOUCHER_CHUNK_SEND",
                null,
                data.batchId
            );

            await sendChunkedResponse(
                syncSocket,
                "voucherByGuid",
                [],
                undefined,
                data.requestId
            );

        }

        sendProgress(
            "VOUCHER_COMPLETE",
            null,
            data.batchId
        );

        // Abhi sirf test
        console.log("✅ Request Chunking Working");

    } catch (err) {

        console.error(
            "VOUCHER BY GUID COMPLETE ERROR",
            err
        );

       syncSocket.emit(
            "voucherByGuidResult",
            {
                requestId: data?.requestId,
                success: false,
                error: err.message
            }
        );

    }

});



syncSocket.on("voucherByGuid", async (data) => {

    try {

     const vouchers =
    await withTallyOperationQueue(() =>
        importVoucherBulkByGuid({
            company: data.company,
            voucherGuids: data.voucherGuids
        })
    );

       syncSocket.emit(
            "voucherByGuidResult",
            {
                requestId: data.requestId,
                success: true,
                collectionName: "vouchers",
                voucherCount: vouchers.length
            }
        );

        if (vouchers.length > 0) {

            await sendChunkedResponse(
                syncSocket,
                "voucherByGuid",
                vouchers,
                undefined,
                data.requestId
            );

            console.log(
                "✅ Missing Voucher chunks sent"
            );

        } else {

            await sendChunkedResponse(
                syncSocket,
                "voucherByGuid",
                [],
                undefined,
                data.requestId
            );

        }

    } catch (err) {

        console.error(
            "VOUCHER BY GUID ERROR",
            err
        );

       syncSocket.emit(
                "voucherByGuidResult",
                {
                    requestId: data?.requestId,
                    success: false,
                    error: err.message
                }
            );

    }

});



syncSocket.on("stockByGuid", async (data) => {

    try {

        const stocks =
    await withTallyOperationQueue(() =>
        importStockBulkByGuid({
            company: data.company,
            stockGuids: data.stockGuids
        })
    );

      syncSocket.emit(
    "stockByGuidResult",
    {
        requestId: data.requestId,
        success: true,
        collectionName: "stocks",
        stockCount: stocks.length
    }
);

      if (stocks.length > 0) {

    await sendChunkedResponse(
        syncSocket,
        "stockByGuid",
        stocks,
        undefined,
        data.requestId
    );
            console.log(
                "✅ Missing Stock chunks sent"
            );

       } else {

    await sendChunkedResponse(
        syncSocket,
        "stockByGuid",
        [],
        undefined,
        data.requestId
    );

}

    } catch (err) {

        console.error(
            "STOCK BY GUID ERROR",
            err
        );

        syncSocket.emit(
    "stockByGuidResult",
    {
        requestId: data?.requestId,
        success: false,
        error: err.message
    }
);

    }

});



syncSocket.on("ledgerByGuid", async (data) => {

    try {

        const ledgers =
    await withTallyOperationQueue(() =>
        importLedgerBulkByGuid({
            company: data.company,
            ledgerGuids: data.ledgerGuids
        })
    );
   syncSocket.emit(
    "ledgerByGuidResult",
    {
        requestId: data.requestId,
        success: true,
        collectionName: "ledgers",
        ledgerCount: ledgers.length
    }
);

        if (ledgers.length > 0) {

           await sendChunkedResponse(
    syncSocket,
    "ledgerByGuid",
    ledgers,
    undefined,
    data.requestId
);

        } else {

           await sendChunkedResponse(
    syncSocket,
    "ledgerByGuid",
    [],
    undefined,
    data.requestId
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

        syncSocket.emit(
    "ledgerByGuidResult",
    {
        requestId: data?.requestId,
        success: false,
        error: err.message
    }
);

    }

});


/*
socket.on("getTrialBalance", async (data) => {

    try {

        const result =
            await getTrialBalance({
                company: data.company,
                asOnDate: data.asOnDate,
                booksBeginningFrom: data.booksBeginningFrom
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

*/

syncSocket.on("getTrialBalance", async (data) => {

    try {

        const result =
    await withTallyOperationQueue(() =>
        getTrialBalance({
            company: data.company,
            asOnDate: data.asOnDate,
            booksBeginningFrom: data.booksBeginningFrom
        })
    );

        const trialBalanceRows =
            Array.isArray(result)
                ? result
                : result?.data || [];

        console.log(
            "Trial Balance Rows :",
            trialBalanceRows.length
        );

        // ======================================
        // SEND RESULT COUNT WITH REQUEST ID
        // ======================================

        syncSocket.emit(
            "getTrialBalanceResult",
            {
                requestId: data.requestId,
                success: true,
                collectionName: "trialBalance",
                trialBalanceCount:
                    trialBalanceRows.length
            }
        );

        // ======================================
        // SEND THROUGH PROTOCOL CHUNKS
        // ======================================

        await syncProtocolController.sendTrialBalance(
    trialBalanceRows,
    data.requestId
);
        console.log(
            "✅ Trial Balance sent through protocol"
        );

    } catch (err) {

        console.error(
            "GET TRIAL BALANCE ERROR",
            err
        );

        syncSocket.emit(
            "getTrialBalanceResult",
            {
                requestId: data?.requestId,
                success: false,
                error: err.message
            }
        );

    }

});





}

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