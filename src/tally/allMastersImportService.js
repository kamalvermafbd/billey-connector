const {
    sendToTally,
    selectCompany
} = require("./tallyService");

const {
    buildAllMastersRequest
} = require("./allMastersRequest");

async function importAllMasters({
    company
}) {

    await selectCompany(company);

    const requestXml = buildAllMastersRequest();

    const responseXml = await sendToTally(requestXml);

    require("fs").writeFileSync(
        "all-masters-response.xml",
        responseXml
    );

    return responseXml;

}

module.exports = {
    importAllMasters
};