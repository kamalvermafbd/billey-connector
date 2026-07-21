const fs = require("fs");

const {
    sendToTally,
    selectCompany
} = require("./tallyService");

const {
    buildCompanyRequest
} = require("./companyRequest");

const {
    parseCompanyResponse
} = require("./companyParser");

async function importCompany({
    company
}) {

    await selectCompany(company);

    const requestXml = buildCompanyRequest(company);

    const responseXml = await sendToTally(requestXml);

    // ===== DEBUG =====
    fs.writeFileSync(
        "./company-response.xml",
        responseXml,
        "utf8"
    );
    // =================

    return parseCompanyResponse(responseXml);

}

module.exports = {
    importCompany
};