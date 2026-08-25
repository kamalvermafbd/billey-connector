const {
    getGroups,
    getAllLedgers,
    buildGroupTree
} = require("./src/tally/tallyService");

function getNatureFromReservedName(reservedName) {

    const value = String(reservedName || "").trim();

    if (
        value === "Current Assets" ||
        value === "Fixed Assets"
    ) {
        return "Assets";
    }

    if (
        value === "Current Liabilities" ||
        value === "Loans (Liability)"
    ) {
        return "Liabilities";
    }

    if (
        value === "Direct Expenses" ||
        value === "Indirect Expenses" ||
        value === "Purchase Accounts"
    ) {
        return "Expenses";
    }

    if (
        value === "Direct Incomes" ||
        value === "Indirect Incomes" ||
        value === "Sales Accounts"
    ) {
        return "Income";
    }

    return "";
}

function resolveLedgerClassification(
    ledger,
    groupMap
) {

    let currentGroup =
        String(ledger.parent || "").trim();

    const visited = new Set();

    while (
        currentGroup &&
        !visited.has(currentGroup)
    ) {

        visited.add(currentGroup);

        const group =
            groupMap[currentGroup];

        if (!group) {
            break;
        }

        if (group.reservedName) {

            const nature =
                getNatureFromReservedName(
                    group.reservedName
                );

            if (nature) {

                return {
                    reservedGroup:
                        group.reservedName,

                    nature
                };

            }
        }

        currentGroup =
            String(group.parent || "")
                .trim()
                .replace(/^Primary$/, "")
                .replace(/^Primary$/i, "");

    }

    return {
        reservedGroup: "",
        nature: ""
    };
}

async function test() {

    try {

        const company =
            "Guru Kirpa Trading";

        console.log("================================");
        console.log("LEDGER CLASSIFICATION TEST");
        console.log("COMPANY :", company);
        console.log("================================");

        const groups =
    await getGroups(company);

const groupTree =
    buildGroupTree(groups);

    const groupMap = {};

for (const group of groups) {

    groupMap[
        String(group.name || "").trim()
    ] = group;

}

const ledgers =
    await getAllLedgers(
        company,
        groupTree
    );

        console.log(
            "TOTAL LEDGERS :",
            ledgers.length
        );

        console.log("================================");
        console.log("LEDGER CLASSIFICATION");
        console.log("================================");

        const result = ledgers.map(ledger => {

            const classification =
                resolveLedgerClassification(
                    ledger,
                    groupMap
                );

            return {

                guid:
                    ledger.guid || "",

                ledger:
                    ledger.name || "",

                parent:
                    ledger.parent || "",

                reservedGroup:
                    classification.reservedGroup,

                nature:
                    classification.nature

            };

        });

        for (const row of result) {

            console.log(
                `${row.ledger} | ` +
                `${row.parent} | ` +
                `${row.reservedGroup} | ` +
                `${row.nature}`
            );

        }

        console.log("================================");
        console.log("CLASSIFICATION TEST FINISHED");
        console.log("================================");

    } catch (err) {

        console.error(
            "CLASSIFICATION TEST ERROR:",
            err
        );

    }

}

test();