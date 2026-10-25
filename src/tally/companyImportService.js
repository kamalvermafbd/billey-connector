

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

const {
    withTallyOperationQueue
} = require("./tallyOperationQueue");

async function importCompany({ company }) {

    return withTallyOperationQueue(async () => {

        await selectCompany(company);

        const requestXml = buildCompanyRequest(company);

        const responseXml = await sendToTally(requestXml);

        return parseCompanyResponse(responseXml);

    });

}

module.exports = {
    importCompany
};