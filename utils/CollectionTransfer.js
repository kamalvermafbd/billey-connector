const ConnectorProtocolSender =
    require("./protocol/ConnectorProtocolSender");


const {
    DEFAULT_MAX_CHUNK_SIZE
} = require("./ChunkBuilder");


const MASTER_COLLECTIONS = [

    {
        event: "getMastersGroups",
        key: "groups"
    },

    {
        event: "getMastersUnits",
        key: "units"
    },

    {
        event: "getMastersLedgers",
        key: "ledgers"
    },

    {
        event: "getMastersStockGroups",
        key: "stockGroups"
    },

    {
        event: "getMastersStocks",
        key: "stocks"
    },

    {
        event: "getMastersGodowns",
        key: "godowns"
    },

    {
        event: "getMastersCostCentres",
        key: "costCentres"
    },

    {
        event: "getMasters",
        key: "vouchers"
    }

];

async function sendCollections(
    socket,
    result
) {

    const sender =
    new ConnectorProtocolSender(
        socket
    );

    for (const collection of MASTER_COLLECTIONS) {

        const rows =
            result[collection.key] || [];

        console.log(
            `================================`
        );

        console.log(
            `${collection.key} : ${rows.length}`
        );

        if (rows.length === 0) {

            console.log(
                `Skipping ${collection.key}`
            );

            continue;

        }

        await sender.sendCollection(

    collection.event,

    rows,

    DEFAULT_MAX_CHUNK_SIZE

);

        console.log(
            `Finished ${collection.key}`
        );

    }

}

module.exports = {

    sendCollections,

    MASTER_COLLECTIONS

};