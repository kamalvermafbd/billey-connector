const {
    sendToTally
} = require("./tallyService");

const {
    buildStockSummaryRequest
} = require("./stockSummaryRequest");


// ==========================================
// PARSE GODOWN-WISE STOCK
// ==========================================

function parseGodownWiseStock(response) {

    const xmlText =
        String(response);


    const itemBlocks =
        xmlText.match(
            /<DSPACCNAME>[\s\S]*?(?=<DSPACCNAME>|<\/ENVELOPE>)/g
        ) || [];


    const godownStock = [];


    for (const block of itemBlocks) {

        const itemNameMatch =
            block.match(
                /<DSPDISPNAME>([\s\S]*?)<\/DSPDISPNAME>/
            );


        if (!itemNameMatch) {
            continue;
        }


        const stockItemName =
            itemNameMatch[1]
                .replace(/&amp;/g, "&")
                .replace(/&quot;/g, '"')
                .trim();


        const godownMatches = [
            ...block.matchAll(
                /<SSGODOWN>([\s\S]*?)<\/SSGODOWN>[\s\S]*?<DSPCLQTY>([\s\S]*?)<\/DSPCLQTY>/g
            )
        ];


        for (const match of godownMatches) {

            const godownName =
                match[1].trim();


            const closingBalance =
                match[2].trim();


            const qtyMatch =
                closingBalance.match(
                    /^(-?\d+(?:\.\d+)?)\s*(.*)$/
                );


            if (!qtyMatch) {
                continue;
            }


            godownStock.push({

                stockItemName,

                godownName,

                closingQuantity:
                    Number(qtyMatch[1]),

                unit:
                    qtyMatch[2].trim()

            });

        }

    }


    return godownStock;

}


// ==========================================
// IMPORT GODOWN-WISE STOCK FROM TALLY
// ==========================================

async function importStockSummary({

    company,

    booksBeginningFrom

}) {

    if (!company) {

        throw new Error(
            "company missing in importStockSummary"
        );

    }


    if (!booksBeginningFrom) {

        throw new Error(
            "booksBeginningFrom missing in importStockSummary"
        );

    }


    // ======================================
    // BUILD REQUEST
    // ======================================

    const xml =
        buildStockSummaryRequest({

            company,

            booksBeginningFrom

        });


    console.log(
        "======================================"
    );

    console.log(
        "IMPORTING GODOWN-WISE STOCK"
    );

    console.log(
        "COMPANY :",
        company
    );

    console.log(
        "BOOKS FROM :",
        booksBeginningFrom
    );

    console.log(
        "======================================"
    );


    // ======================================
    // SEND TO TALLY
    // ======================================

    const response =
        await sendToTally(xml);

        console.log(
    "========== STOCK SUMMARY RAW XML =========="
);

console.log(
    String(response).slice(0, 20000)
);

console.log(
    "==========================================="
);


    // ======================================
    // PARSE GODOWN STOCK
    // ======================================

    const stock =
        parseGodownWiseStock(response);


    console.log(
        "======================================"
    );

    console.log(
        "GODOWN-WISE STOCK IMPORTED"
    );

    console.log(
        "ROWS :",
        stock.length
    );

    console.dir(
        stock,
        {
            depth: null
        }
    );

    console.log(
        "======================================"
    );


    return {

        success: true,

        data: stock,

        summary: {

            stockGodownRows:
                stock.length

        }

    };

}


module.exports = {

    importStockSummary,

    parseGodownWiseStock

};