const { createClient } =
    require("@supabase/supabase-js");


const supabase =
    createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
    );


// ==========================================
// SAVE GODOWN-WISE STOCK
// ==========================================

async function saveStockGodownBalances({

    company_code,

    tally_owner,

    sync_batch_id,

    stock = []

}) {

    if (!company_code) {

        throw new Error(
            "company_code missing in saveStockGodownBalances"
        );

    }


    if (!tally_owner) {

        throw new Error(
            "tally_owner missing in saveStockGodownBalances"
        );

    }


    if (!sync_batch_id) {

        throw new Error(
            "sync_batch_id missing in saveStockGodownBalances"
        );

    }


    if (!Array.isArray(stock)) {

        throw new Error(
            "stock must be an array in saveStockGodownBalances"
        );

    }


    if (stock.length === 0) {

        return {
            inserted: 0
        };

    }


    const rows =
        stock
            .filter(item =>
                item?.stockGuid &&
                item?.stockItemName &&
                item?.godownName
            )
            .map(item => ({

                company_code,

                tally_owner,

                stock_guid:
                    item.stockGuid,

                stock_name:
                    item.stockItemName,

                godown_guid:
                    item.godownGuid || null,

                godown_name:
                    item.godownName,

                closing_quantity:
                    item.closingQuantity ?? null,

                unit:
                    item.unit || null,

                sync_batch_id,

                last_synced_at:
                    new Date().toISOString(),

                updated_at:
                    new Date().toISOString()

            }));


    if (rows.length === 0) {

        return {
            inserted: 0
        };

    }


    const { error } =
        await supabase
            .from("tally_stock_godown_balances")
            .upsert(
                rows,
                {
                    onConflict:
                        "company_code,tally_owner,stock_guid,godown_name"
                }
            );


    if (error) {

        throw new Error(
            `saveStockGodownBalances failed: ${error.message}`
        );

    }


    return {

        inserted:
            rows.length

    };

}


module.exports = {
    saveStockGodownBalances
};