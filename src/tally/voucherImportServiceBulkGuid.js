const {
    sendToTally,
    selectCompany
} = require("./tallyService");

const {
    buildVoucherBulkGuidRequest
} = require("./voucherBulkGuidRequest");

const {
    parseVoucherResponse
} = require("./voucherParser");

const {
    getLookups
} = require("./lookupCache");

const {
    buildChunks
} = require("../../utils/ChunkBuilder");

const {
    executeChunks
} = require("../../utils/chunkExecutor");

const fs = require("fs");

const BULK_GUID_CHUNK_SIZE = 300 * 1024;

async function importVoucherBulkByGuid({
    company,
    voucherGuids
}){

    await selectCompany(company);

  

    const lookups = getLookups(company);

if (!lookups) {

    throw new Error(
        "Lookup cache not found. Run importMasters() before Bulk GUID import."
    );

}

if (!voucherGuids?.length) {

    return [];

}

const chunks = buildChunks(
    voucherGuids,
    BULK_GUID_CHUNK_SIZE
);

const allVouchers = [];

await executeChunks({

    chunks,

    onChunk: async (chunk) => {

        const requestXml =
            buildVoucherBulkGuidRequest({

                company,

                voucherGuids: chunk.data

            });

        fs.writeFileSync(

            `./logs/voucher-bulk-guid-request-${chunk.chunkIndex}.xml`,

            requestXml,

            "utf8"

        );

        const responseXml =
            await sendToTally(requestXml);

        fs.writeFileSync(

            `./logs/voucher-bulk-guid-response-${chunk.chunkIndex}.xml`,

            responseXml,

            "utf8"

        );

        if (!responseXml) {

            throw new Error(
                "Empty response received from Tally."
            );

        }

        const vouchers =
            parseVoucherResponse(
                responseXml,
                lookups
            );

        fs.writeFileSync(

            `./logs/voucher-bulk-guid-parsed-${chunk.chunkIndex}.json`,

            JSON.stringify(
                vouchers,
                null,
                2
            ),

            "utf8"

        );

        allVouchers.push(...vouchers);

       return {

    chunkIndex: chunk.chunkIndex,

    totalChunks: chunk.totalChunks,

    vouchers: vouchers.length

};

    }

});

return allVouchers;

}

module.exports = {
    importVoucherBulkByGuid
};