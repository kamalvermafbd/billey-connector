const ConnectorProtocolSender =
    require("./ConnectorProtocolSender");

const {
    DEFAULT_MAX_CHUNK_SIZE
} = require("../ChunkBuilder");

class ConnectorProtocolController {

    constructor(socket) {

        this.sender =
            new ConnectorProtocolSender(
                socket
            );

    }

    async sendCollection(
    event,
    rows,
    requestId
) {

    console.log(
        `================================`
    );

    console.log(
        `${event} : ${rows.length}`
    );

    if (rows.length === 0) {

        console.log(
            `Empty collection : ${event}`
        );

        await this.sender.sendCollection(
            event,
            [],
            DEFAULT_MAX_CHUNK_SIZE,
            requestId
        );

        console.log(
            `Finished ${event}`
        );

        return;

    }

    await this.sender.sendCollection(
        event,
        rows,
        DEFAULT_MAX_CHUNK_SIZE,
        requestId
    );

    console.log(
        `Finished ${event}`
    );

}
async sendStockGodownSummary(rows, requestId) {

    await this.sendCollection(
        "getStockGodownSummary",
        rows || [],
        requestId
    );

}
async sendTrialBalance(rows, requestId) {

    await this.sendCollection(
        "getTrialBalance",
        rows || [],
        requestId
    );

}

async sendMasters(result, requestId) {

    await this.sendCollection(
        "getMastersGroups",
        result.groups || [],
        requestId
    );

    await this.sendCollection(
        "getMastersUnits",
        result.units || [],
        requestId
    );

    console.log("================================");
    console.log("SEND MASTER LEDGERS");
    console.log("result.ledgers :", result.ledgers?.length);
    console.log("first ledger :", result.ledgers?.[0]);
    console.log("================================");

    const newTech = result.ledgers?.find(
        ledger => ledger.name === "NEW TECH CHEMICALS"
    );

    console.log("================================");
    console.log("NEW TECH CHEMICALS CONNECTOR DATA");
    console.dir(newTech, { depth: null });
    console.log("================================");

    await this.sendCollection(
        "getMastersLedgers",
        result.ledgers || [],
        requestId
    );

    await this.sendCollection(
        "getMastersStockGroups",
        result.stockGroups || [],
        requestId
    );

    await this.sendCollection(
        "getMastersStocks",
        result.stocks || [],
        requestId
    );

    await this.sendCollection(
        "getMastersGodowns",
        result.godowns || [],
        requestId
    );

    await this.sendCollection(
        "getMastersCostCentres",
        result.costCentres || [],
        requestId
    );

    await this.sendCollection(
        "getMasters",
        result.vouchers || [],
        requestId
    );

}
}

module.exports =
    ConnectorProtocolController;