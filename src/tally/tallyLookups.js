function buildTallyLookups({

    groups = [],

    ledgers = [],

    stocks = []

})  {

    const ledgerLookup = new Map(
        ledgers.map(l => [
            (l.name || "").trim().toUpperCase(),
            l
        ])
    );

    const partyLookup = new Map(
        ledgers
            .filter(l => l.isParty)
            .map(l => [
                (l.name || "").trim().toUpperCase(),
                l
            ])
    );

    const groupLookup = new Map(
        groups.map(g => [
            (g.name || "").trim().toUpperCase(),
            g
        ])
    );

    const stockLookup = new Map(
        stocks.map(s => [
            String(s.masterId || ""),
            s
        ])
    );

    return {

        ledgerLookup,

        stockLookup,

        partyLookup,

        groupLookup

    };

}

module.exports = {

    buildTallyLookups

};