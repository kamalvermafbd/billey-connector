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
    rows
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
        DEFAULT_MAX_CHUNK_SIZE
    );

    console.log(
        `Finished ${event}`
    );

    return;

}

    await this.sender.sendCollection(

        event,

        rows,

        DEFAULT_MAX_CHUNK_SIZE

    );

    console.log(
        `Finished ${event}`
    );

}

async sendMasters(result) {

    await this.sendCollection(
        "getMastersGroups",
        result.groups || []
    );

    await this.sendCollection(
        "getMastersUnits",
        result.units || []
    );

    console.log("================================");
console.log("SEND MASTER LEDGERS");
console.log("result.ledgers :", result.ledgers?.length);
console.log("first ledger :", result.ledgers?.[0]);
console.log("================================");

    await this.sendCollection(
        "getMastersLedgers",
        result.ledgers || []
    );

    await this.sendCollection(
        "getMastersStockGroups",
        result.stockGroups || []
    );

    await this.sendCollection(
        "getMastersStocks",
        result.stocks || []
    );

    await this.sendCollection(
        "getMastersGodowns",
        result.godowns || []
    );

    await this.sendCollection(
        "getMastersCostCentres",
        result.costCentres || []
    );

    await this.sendCollection(
        "getMasters",
        result.vouchers || []
    );

}

}

module.exports =
    ConnectorProtocolController;