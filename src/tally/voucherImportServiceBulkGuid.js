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
/*
const {
    buildChunks
} = require("../../utils/ChunkBuilder");
*/

const {
    executeChunks
} = require("../../utils/chunkExecutor");


const VOUCHER_GUID_BATCH_SIZE = 100;
const VOUCHER_XML_MAX_SIZE = 300 * 1024;

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

const chunks = [];

let currentChunk = [];

for (const guid of voucherGuids) {

    if (currentChunk.length >= VOUCHER_GUID_BATCH_SIZE) {

        chunks.push({
            chunkIndex: chunks.length + 1,
            data: currentChunk
        });

        currentChunk = [];
    }

    const testChunk = [
        ...currentChunk,
        guid
    ];

   const testXml =
    buildVoucherBulkGuidRequest({
        company,
        voucherGuids: testChunk
    });

    const testXmlSize =
        Buffer.byteLength(
            testXml,
            "utf8"
        );


    // ============================================
    // 300 KB LIMIT
    // ============================================

    if (
        testXmlSize > VOUCHER_XML_MAX_SIZE &&
        currentChunk.length > 0
    ) {

        chunks.push({

            chunkIndex:
                chunks.length + 1,

            data:
                currentChunk

        });

        currentChunk = [guid];

        continue;
    }


    // Single Voucher GUID itself > 300 KB
    if (
        testXmlSize > VOUCHER_XML_MAX_SIZE &&
        currentChunk.length === 0
    ) {

        throw new Error(
            `Single Voucher GUID request exceeds 300 KB: ${guid}`
        );

    }


    currentChunk.push(guid);
}


// ============================================
// LAST CHUNK
// ============================================

if (currentChunk.length > 0) {

    chunks.push({

        chunkIndex:
            chunks.length + 1,

        data:
            currentChunk

    });

}


console.log(
    "===================================="
);

console.log(
    "VOUCHER BULK GUID CHUNKS"
);

console.log(
    "Total GUIDs:",
    voucherGuids.length
);

console.log(
    "Total Chunks:",
    chunks.length
);

console.log(
    "Max GUIDs / Chunk:",
    VOUCHER_GUID_BATCH_SIZE
);

console.log(
    "Max XML Size:",
    VOUCHER_XML_MAX_SIZE,
    "bytes"
);

console.log(
    "===================================="
);


const allVouchers = [];


const totalChunks =
    chunks.length;

for (const chunk of chunks) {

    chunk.totalChunks =
        totalChunks;

}

await executeChunks({

    chunks,

    onChunk: async (chunk) => {

        const requestXml =
    buildVoucherBulkGuidRequest({
        company,
        voucherGuids: chunk.data
    });
        
        const responseXml =
            await sendToTally(requestXml);

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

        console.log(
            "BULK CHUNK:",
            chunk.chunkIndex,
            "/",
            chunk.totalChunks,
            "| GUIDs:",
            chunk.data.length,
            "| Response Bytes:",
            Buffer.byteLength(
                String(responseXml || ""),
                "utf8"
            ),
            "| Vouchers:",
            vouchers.length
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