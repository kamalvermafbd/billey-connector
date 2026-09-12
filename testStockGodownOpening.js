const {
    sendToTally,
    selectCompany
} = require("./src/tally/tallyService");

const {
    parseStockResponse
} = require("./src/tally/stockParser");


(async () => {

    const company =
        "Sunil Ent(Client";

    const stockGuid =
        "755da616-c913-46c0-9ad0-de5499d071a0-000000d1";


    try {

        console.log("================================");
        console.log("STOCK GODOWN OPENING TEST");
        console.log("================================");

        console.log(
            "Company:",
            company
        );

        console.log(
            "Stock GUID:",
            stockGuid
        );


        // ============================================
        // STEP 1
        // Select company
        // ============================================

        await selectCompany(company);


        // ============================================
        // STEP 2
        // Direct Tally request
        // ============================================

        const requestXml = `

<ENVELOPE>

    <HEADER>

        <VERSION>1</VERSION>

        <TALLYREQUEST>Export</TALLYREQUEST>

        <TYPE>Collection</TYPE>

        <ID>BilleyStockGodownOpeningTest</ID>

    </HEADER>

    <BODY>

        <DESC>

            <STATICVARIABLES>

                <SVCURRENTCOMPANY>${company}</SVCURRENTCOMPANY>

                <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>

            </STATICVARIABLES>

            <TDL>

                <TDLMESSAGE>

                    <COLLECTION NAME="BilleyStockGodownOpeningTest">

                        <TYPE>Stock Item</TYPE>

                        <FILTER>StockGuidFilter</FILTER>

                        <FETCH>

                            GUID,
                            NAME,
                            BASEUNITS,
                            OPENINGBALANCE,
                            OPENINGVALUE,
                            OPENINGRATE,
                            BATCHALLOCATIONS.LIST

                        </FETCH>

                    </COLLECTION>


                    <SYSTEM
                        TYPE="Formulae"
                        NAME="StockGuidFilter">

                        $$IsEqual:$GUID:"${stockGuid}"

                    </SYSTEM>

                </TDLMESSAGE>

            </TDL>

        </DESC>

    </BODY>

</ENVELOPE>

`;


        console.log(
            "Sending godown opening request..."
        );


        const responseXml =
            await sendToTally(
                requestXml
            );


        if (!responseXml) {

            throw new Error(
                "Empty response received from Tally."
            );

        }


        // ============================================
        // STEP 3
        // Raw response
        // ============================================

        console.log(
            "================================"
        );

        console.log(
            "RAW RESPONSE:"
        );

        console.log(
            responseXml
        );

        console.log(
            "================================"
        );


        // ============================================
        // STEP 4
        // Parse stock
        // ============================================

        const stocks =
            parseStockResponse(
                responseXml
            );


        console.log(
            "Parsed Stocks:",
            stocks.length
        );


        // ============================================
        // STEP 5
        // Direct XML extraction
        // ============================================

        const stockMatch =
            responseXml.match(
                /<STOCKITEM[\s\S]*?<\/STOCKITEM>/i
            );


        if (!stockMatch) {

            console.log(
                "No STOCKITEM found."
            );

            return;

        }


        const stockXml =
            stockMatch[0];


        // ============================================
        // Find all BATCHALLOCATIONS.LIST blocks
        // ============================================

        const batchMatches =
            stockXml.match(
                /<BATCHALLOCATIONS\.LIST[^>]*>[\s\S]*?<\/BATCHALLOCATIONS\.LIST>/gi
            ) || [];


        console.log(
            "================================"
        );

        console.log(
            "GODOWN OPENING ALLOCATIONS:",
            batchMatches.length
        );

        console.log(
            "================================"
        );


        // ============================================
        // Parse each godown allocation
        // ============================================

        for (
            const batchXml of batchMatches
        ) {

            const godownMatch =
                batchXml.match(
                    /<GODOWNNAME[^>]*>(.*?)<\/GODOWNNAME>/i
                );

            const batchNameMatch =
                batchXml.match(
                    /<BATCHNAME[^>]*>(.*?)<\/BATCHNAME>/i
                );

            const openingBalanceMatch =
                batchXml.match(
                    /<OPENINGBALANCE[^>]*>(.*?)<\/OPENINGBALANCE>/i
                );

            const openingValueMatch =
                batchXml.match(
                    /<OPENINGVALUE[^>]*>(.*?)<\/OPENINGVALUE>/i
                );

            const openingRateMatch =
                batchXml.match(
                    /<OPENINGRATE[^>]*>(.*?)<\/OPENINGRATE>/i
                );


            const godown =
                godownMatch
                    ? godownMatch[1].trim()
                    : "";


            const batchName =
                batchNameMatch
                    ? batchNameMatch[1].trim()
                    : "";


            const openingBalance =
                openingBalanceMatch
                    ? openingBalanceMatch[1].trim()
                    : "";


            const openingValue =
                openingValueMatch
                    ? openingValueMatch[1].trim()
                    : "";


            const openingRate =
                openingRateMatch
                    ? openingRateMatch[1].trim()
                    : "";


            console.log(
                "--------------------------------"
            );

            console.log(
                "Godown:",
                godown
            );

            console.log(
                "Batch:",
                batchName
            );

            console.log(
                "Opening Balance:",
                openingBalance
            );

            console.log(
                "Opening Value:",
                openingValue
            );

            console.log(
    "Opening Godowns:",
    stock.openingGodowns
);

            console.log(
                "Opening Rate:",
                openingRate
            );

            console.log(
                "--------------------------------"
            );

        }


        // ============================================
        // Stock level opening
        // ============================================

        if (stocks.length > 0) {

            const stock =
                stocks[0];

            console.log(
                "================================"
            );

            console.log(
                "STOCK LEVEL OPENING"
            );

            console.log(
                "Stock:",
                stock.name
            );

            console.log(
                "GUID:",
                stock.guid
            );

            console.log(
                "Opening Balance:",
                stock.openingBalance
            );

            console.log(
                "Opening Rate:",
                stock.openingRate
            );

            console.log(
                "Opening Value:",
                stock.openingValue
            );

            console.log(
                "================================"
            );

        }


        console.log(
            "STOCK GODOWN OPENING TEST COMPLETED"
        );


    }
    catch (err) {

        console.error(
            "================================"
        );

        console.error(
            "STOCK GODOWN OPENING TEST FAILED"
        );

        console.error(
            err
        );

        console.error(
            "================================"
        );

    }

})();