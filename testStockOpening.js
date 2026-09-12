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
        console.log("STOCK OPENING BALANCE TEST");
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
        // Direct Tally Stock Master Request
        // ============================================

        const requestXml = `

<ENVELOPE>

    <HEADER>

        <VERSION>1</VERSION>

        <TALLYREQUEST>Export</TALLYREQUEST>

        <TYPE>Collection</TYPE>

        <ID>BilleyStockOpeningTest</ID>

    </HEADER>

    <BODY>

        <DESC>

            <STATICVARIABLES>

                <SVCURRENTCOMPANY>${company}</SVCURRENTCOMPANY>

                <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>

            </STATICVARIABLES>

            <TDL>

                <TDLMESSAGE>

                    <COLLECTION NAME="BilleyStockOpeningTest">

                        <TYPE>Stock Item</TYPE>

                        <FILTER>StockGuidFilter</FILTER>

                        <FETCH>

                            GUID,
                            NAME,
                            BASEUNITS,
                            OPENINGBALANCE,
                            OPENINGVALUE,
                            OPENINGRATE

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
            "Sending opening balance request..."
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
        // Existing parser test
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
        // Opening values + GUID comparison
        // ============================================

        for (
            const stock of stocks
        ) {

            console.log(
                "--------------------------------"
            );


            console.log(
                "Stock Name:",
                stock.name
            );


            // ========================================
            // Compare parser GUID with raw XML GUID
            // ========================================

            const rawGuidMatch =
                responseXml.match(
                    /<GUID[^>]*>(.*?)<\/GUID>/i
                );


            const rawGuid =
                rawGuidMatch
                    ? rawGuidMatch[1].trim()
                    : null;


            console.log(
                "Parser GUID:",
                stock.guid
            );


            console.log(
                "Raw XML GUID:",
                rawGuid
            );


            console.log(
                "GUID MATCH:",
                String(
                    stock.guid || ""
                ).trim() === rawGuid
            );


            console.log(
                "Base Unit:",
                stock.baseUnit
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
    "Opening Godowns:",
    stock.openingGodowns
);


            console.log(
                "--------------------------------"
            );

        }


        console.log(
            "STOCK OPENING TEST COMPLETED"
        );


    }
    catch (err) {

        console.error(
            "STOCK OPENING TEST FAILED"
        );

        console.error(
            err
        );

    }

})();