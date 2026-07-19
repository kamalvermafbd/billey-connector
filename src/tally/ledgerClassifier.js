// =========================
// SALES GL
// =========================

function getSalesGL(allLedgers) {

    return allLedgers.filter(x =>
        x.parent === "Sales Accounts"
    );

}

// =========================
// TAX GL
// =========================

function getTaxGL(allLedgers) {

    return allLedgers.filter(x =>
        x.parent === "Duties & Taxes"
    );

}

// =========================
// DEBTORS
// =========================

function getDebtors(allLedgers) {

    return allLedgers.filter(x =>
        x.parent === "Sundry Debtors"
    );

}

// =========================
// ROUND OFF
// =========================

function getRoundOffGL(allLedgers) {

    return allLedgers.filter(x =>
        x.name.toUpperCase().includes("ROUND")
    );

}

module.exports = {

    getSalesGL,

    getTaxGL,

    getDebtors,

    getRoundOffGL

};