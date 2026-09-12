const {
    importStockBulkByGuid
} = require("./src/tally/stockImportServiceBulkGuid");

(async () => {

    const company =
        "Sunil Ent(Client";

    const stockGuid =
        "755da616-c913-46c0-9ad0-de5499d071a0-000000d1";


    try {

        console.log("================================");
        console.log("STOCK BULK OPENING TEST");
        console.log("================================");

        console.log(
            "Company:",
            company
        );

        console.log(
            "Requested GUID:",
            stockGuid
        );


        // ============================================
        // BULK IMPORT
        // Only ONE stock GUID
        // ============================================

        const stocks =
            await importStockBulkByGuid({
                company,
                stockGuids: [
                    stockGuid
                ]
            });


        console.log(
            "================================"
        );

        console.log(
            "TOTAL STOCKS RETURNED:",
            stocks.length
        );

        console.log(
            "================================"
        );


        // ============================================
        // RESULT
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

            console.log(
                "GUID:",
                stock.guid
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
                "Parent Group GUID:",
                stock.parentGroupGuid
            );

            console.log(
                "--------------------------------"
            );

        }


        // ============================================
        // VALIDATION
        // ============================================

        const returned =
            stocks.find(
                stock =>
                    String(
                        stock.guid || ""
                    ).trim() === stockGuid
            );


        console.log(
            "================================"
        );

        console.log(
            "GUID FOUND:",
            Boolean(returned)
        );


        if (returned) {

            console.log(
                "OPENING BALANCE:",
                returned.openingBalance
            );

            console.log(
                "OPENING RATE:",
                returned.openingRate
            );

            console.log(
                "OPENING VALUE:",
                returned.openingValue
            );

        }


        console.log(
            "================================"
        );

        console.log(
            "STOCK BULK OPENING TEST COMPLETED"
        );

        console.log(
            "================================"
        );


    }
    catch (err) {

        console.error(
            "================================"
        );

        console.error(
            "STOCK BULK OPENING TEST FAILED"
        );

        console.error(
            err
        );

        console.error(
            "================================"
        );

    }

})();