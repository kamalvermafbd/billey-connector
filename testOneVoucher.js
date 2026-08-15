const {
    getGroups,
    getAllLedgers,
    getStockItems
} = require("./src/tally/tallyService");

const {
    buildTallyLookups
} = require("./src/tally/tallyLookups");

const {
    setLookups
} = require("./src/tally/lookupCache");

const {
    importVoucherBulkByGuid
} = require("./src/tally/voucherImportServiceBulkGuid");


(async () => {

    const company =
        "Guru Kirpa Trading";

    const guid =
        "b06ee43a-c023-4bfc-b8d9-3fd85283e679-00000e85";


    try {

        console.log("======================================");
        console.log("ONE MISSING VOUCHER GUID TEST");
        console.log("======================================");

        console.log("Company :", company);
        console.log("GUID    :", guid);


        // ============================================
        // STEP 1
        // BUILD SAME LOOKUP CACHE AS PRODUCTION
        // ============================================

        console.log("");
        console.log("BUILDING LOOKUP CACHE...");
        console.log("");


        console.log("Fetching Groups...");

        const groups =
            await getGroups(company);

        console.log(
            "Groups:",
            groups.length
        );


        // ============================================
        // GROUP TREE
        // ============================================

        const groupTree = {};

        groups.forEach(group => {

            groupTree[group.name] =
                group.parent;

        });


        // ============================================
        // LEDGERS
        // ============================================

        console.log(
            "Fetching Full Ledgers..."
        );

        const allLedgers =
            await getAllLedgers(
                company,
                groupTree
            );

        console.log(
            "All Ledgers:",
            allLedgers.length
        );


        // ============================================
        // STOCKS
        // ============================================

        console.log(
            "Fetching Full Stocks..."
        );

        const stockJson =
            await getStockItems(company);


        const stockRaw =
            stockJson
                ?.ENVELOPE
                ?.BODY
                ?.DATA
                ?.COLLECTION
                ?.STOCKITEM;


        const stockItems =
            Array.isArray(stockRaw)
                ? stockRaw
                : stockRaw
                    ? [stockRaw]
                    : [];


        const allStocks =
            stockItems.map(item => ({

                name:
                    item.NAME,

                unit:
                    typeof item.BASEUNITS === "object"
                        ? item.BASEUNITS["#text"]
                        : item.BASEUNITS || ""

            }));


        console.log(
            "All Stocks:",
            allStocks.length
        );


        // ============================================
        // BUILD LOOKUPS
        // ============================================

        const lookups =
            buildTallyLookups({

                groups,

                ledgers:
                    allLedgers,

                stocks:
                    allStocks

            });


        setLookups(
            company,
            lookups
        );


        console.log("");
        console.log("LOOKUP CACHE READY");
        console.log("");

        console.log(
            "Group Lookup:",
            lookups.groupLookup.size
        );

        console.log(
            "Ledger Lookup:",
            lookups.ledgerLookup.size
        );

        console.log(
            "Stock Lookup:",
            lookups.stockLookup.size
        );

        console.log(
            "Party Lookup:",
            lookups.partyLookup.size
        );


        // ============================================
        // STEP 2
        // FETCH ONE MISSING VOUCHER
        // ============================================

        console.log("");
        console.log("======================================");
        console.log("FETCHING ONE MISSING VOUCHER");
        console.log("======================================");

        console.log(
            "GUID:",
            guid
        );


        const vouchers =
            await importVoucherBulkByGuid({

                company,

                voucherGuids: [
                    guid
                ]

            });


        // ============================================
        // RESULT
        // ============================================

        console.log("");
        console.log("======================================");
        console.log("RESULT");
        console.log("======================================");

        console.log(
            "Vouchers Returned:",
            vouchers.length
        );


        if (vouchers.length > 0) {

            const voucher =
                vouchers[0];

            console.log("");
            console.log(
                "Returned GUID:",
                voucher?.header?.guid
            );

            console.log(
                "Voucher Number:",
                voucher?.header?.voucherNumber
            );

            console.log(
                "Alter ID:",
                voucher?.header?.alterid
            );

            console.log(
                "Voucher Type:",
                voucher?.header?.voucherTypeName
            );

            console.log("");

            console.log(
                "RESULT: PASS"
            );

        } else {

            console.log("");
            console.log(
                "RESULT: ZERO VOUCHERS"
            );

        }


        console.log("");
        console.log("======================================");


    } catch (error) {

        console.error("");
        console.error("======================================");
        console.error("TEST FAILED");
        console.error("======================================");

        console.error(
            error.stack || error.message
        );

        console.error(
            "======================================"
        );

        process.exitCode = 1;

    }

})();