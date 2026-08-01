const {
    sendToTally,
    selectCompany
} = require("./tallyService");


const {
    buildUnitGuidRequest
} = require("./unitGuidRequest");


const {
    parseUnitGuidResponse
} = require("./unitGuidParser");


async function importUnitGuids({company}){

    await selectCompany(company);


    const requestXml =
        buildUnitGuidRequest();


    const responseXml =
        await sendToTally(requestXml);


    return parseUnitGuidResponse(responseXml);

}


module.exports = {
    importUnitGuids
};
