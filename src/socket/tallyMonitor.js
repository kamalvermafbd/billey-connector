const {
    getTallyCompanies,
    runWithTallyMonitor
} = require("../tally/tallyService");

const MONITOR_INTERVAL_MS = 5000;

/**
 * Tally Monitor
 *
 * Responsibilities:
 * 1. Har 5 sec Tally ko check karna
 * 2. Tally ONLINE / OFFLINE detect karna
 * 3. Tally mein open companies detect karna
 * 4. Sirf NEW company aane par identifyConnector bhejna
 * 5. Tally OFFLINE -> ONLINE hone par current companies ko
 *    dobara identify karna
 *
 * Existing Tally sync / getMasters flow ko modify nahi karta.
 */

function startTallyMonitor(socket) {

    if (!socket) {
        throw new Error("Tally monitor requires socket");
    }

    // Duplicate monitor prevent karo
    if (socket.tallyMonitorInterval) {
        console.log("⚠️ TALLY MONITOR ALREADY RUNNING");
        return;
    }

    let checking = false;

    // Last known Tally status
    let lastStatus = "UNKNOWN";

    // Last known companies
    // Map: GUID -> company object
    let lastCompanies = new Map();

    /**
     * Convert Tally company array into Map
     */
    function createCompanyMap(companies) {

        const map = new Map();

        for (const company of companies) {

            const guid = String(
                company?.guid || ""
            ).trim();

            if (!guid) {
                continue;
            }

            map.set(guid, {
                name: company?.name || "",
                guid
            });
        }

        return map;
    }

    /**
     * Get only NEW companies
     *
     * Example:
     *
     * Old:
     * A, B
     *
     * New:
     * A, B, C
     *
     * Result:
     * C
     */
    function getNewCompanies(currentCompanies) {

        const newCompanies = [];

        for (const [guid, company] of currentCompanies) {

            if (!lastCompanies.has(guid)) {
                newCompanies.push(company);
            }
        }

        return newCompanies;
    }

    /**
     * Get company names for clean logging
     */
    function companyNames(companies) {

        return companies
            .map(company => company?.name || company?.guid)
            .filter(Boolean);
    }

    async function checkTally() {

        // Previous health check abhi complete nahi hua
        if (checking) {
            return;
        }

        // Connector socket connected nahi hai
        if (!socket.connected) {
            return;
        }

        /*
         * Actual Tally sync/request chal raha ho to
         * parallel Tally request nahi bhejni.
         *
         * Existing getMasters/importMasters flow safe rahega.
         */
        if (
            socket.tallyOperationActive ||
            socket.tallyRequestActive
        ) {
            return;
        }

        checking = true;

        try {

            const result = await runWithTallyMonitor(
    {
        isHealthCheck: true
    },
    () => getTallyCompanies()
);

            if (!result?.success) {
                throw new Error(
                    result?.error ||
                    "Unable to read Tally companies"
                );
            }

            const companies = Array.isArray(result.companies)
                ? result.companies
                : [];

            /*
             * Tally reachable hai.
             *
             * IMPORTANT:
             * companies = [] hone par bhi Tally ONLINE hai.
             */
            const currentCompanies = createCompanyMap(
                companies
            );

            const companyGuids = [
                ...currentCompanies.keys()
            ];

            /*
             * Current Tally state socket par rakho.
             */
            socket.tallyStatus = "ONLINE";
            socket.lastTallyStatusAt = Date.now();
            socket.tallyCompanies = companies;

            /*
             * Server watchdog ko fresh Tally status do.
             *
             * Ye har 5 sec ja sakta hai,
             * lekin console mein kuch print nahi hoga.
             */
            socket.emit("tally:status", {
                status: "ONLINE",
                companies,
                company_guids: companyGuids,
                timestamp: Date.now()
            });

            /*
             * -------------------------------------------------
             * FIRST CONNECTION / TALLY RECOVERY
             * -------------------------------------------------
             *
             * Connector abhi-abhi connected hua hai
             * ya Tally OFFLINE se ONLINE hua hai.
             *
             * Is case mein currently open ALL companies
             * server ko identify karni hain.
             */
            if (
                lastStatus !== "ONLINE"
            ) {

                if (companyGuids.length > 0) {

                    socket.emit(
                        "identifyConnector",
                        {
                            company_guids: companyGuids
                        }
                    );

                    console.log(
                        "📡 TALLY COMPANIES IDENTIFIED:",
                        companyNames(companies)
                    );
                }

                if (lastStatus === "OFFLINE") {

                    console.log(
                        "🟢 TALLY ONLINE"
                    );

                } else {

                    console.log(
                        "🟢 TALLY ONLINE"
                    );
                }

            } else {

                /*
                 * -------------------------------------------------
                 * TALLY ALREADY ONLINE
                 * -------------------------------------------------
                 *
                 * Sirf NEW company detect karo.
                 *
                 * Existing companies ko dobara identify nahi karna.
                 */
                const newCompanies =
                    getNewCompanies(currentCompanies);

                const closedCompanies = [];

                for (const [guid, company] of lastCompanies) {
                    if (!currentCompanies.has(guid)) {
                        closedCompanies.push(company);
                    }
                }

                if (closedCompanies.length > 0) {
                    console.log(
                        "🔴 TALLY COMPANY CLOSED:",
                        companyNames(closedCompanies)
                    );
                }

                if (newCompanies.length > 0) {

                    const newGuids = newCompanies.map(
                        company => company.guid
                    );

                    console.log(
                        "🆕 NEW TALLY COMPANY:",
                        companyNames(newCompanies)
                    );

                    /*
                     * Sirf NEW company ko identify karo.
                     *
                     * Existing companies ko repeat nahi bhejna.
                     */
                    socket.emit(
                        "identifyConnector",
                        {
                            company_guids: newGuids
                        }
                    );

                    console.log(
                        "📡 NEW COMPANY IDENTIFIED:",
                        newGuids
                    );
                }
            }

            /*
             * Current company list ko remember karo.
             *
             * Agar koi company close hoti hai,
             * woh next comparison mein absent hogi.
             *
             * Permanent server pairing delete nahi hogi.
             */
            lastCompanies = currentCompanies;

            /*
             * Status remember karo.
             */
            lastStatus = "ONLINE";

        } catch (err) {

            /*
             * Tally reachable nahi hai.
             */
            socket.tallyStatus = "OFFLINE";
            socket.lastTallyStatusAt = Date.now();
            socket.tallyCompanies = [];

            /*
             * Server watchdog ko OFFLINE state batao.
             */
            socket.emit("tally:status", {
                status: "OFFLINE",
                companies: [],
                company_guids: [],
                timestamp: Date.now()
            });

            /*
             * Sirf first OFFLINE event par log.
             * Har 5 sec same error spam nahi.
             */
            if (lastStatus !== "OFFLINE") {
                console.log("🔴 TALLY OFFLINE");
            }

           /*
 * Tally OFFLINE ho gaya.
 * Purani company list clear karo.
 *
 * Tally wapas ONLINE hone par
 * current companies ko fresh identifyConnector
 * se identify kiya jayega.
 */
lastCompanies = new Map();
lastStatus = "OFFLINE";

        } finally {

            checking = false;
        }
    }

    /*
     * Connector connect hote hi immediate check.
     */
    checkTally();

    /*
     * Uske baad har 5 sec Tally check.
     */
    socket.tallyMonitorInterval = setInterval(
        checkTally,
        MONITOR_INTERVAL_MS
    );

    console.log(
        "🩺 TALLY MONITOR STARTED | CHECK EVERY 5 SEC"
    );
}


/**
 * Tally monitor stop
 */
function stopTallyMonitor(socket) {

    if (socket?.tallyMonitorInterval) {

        clearInterval(
            socket.tallyMonitorInterval
        );

        socket.tallyMonitorInterval = null;

        console.log(
            "🛑 TALLY MONITOR STOPPED"
        );
    }
}


module.exports = {
    startTallyMonitor,
    stopTallyMonitor
};