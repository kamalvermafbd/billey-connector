const {
    sendToTally,
    selectCompany
} = require("./tallyService");

const {
    buildUnitRequest
} = require("./unitRequest");

const {
    parseUnitResponse
} = require("./unitParser");

const {
    buildUnitObjectRequest
} = require("./unitObjectRequest");

const {
    parseUnitObjectResponse
} = require("./parseUnitObjectResponse");

async function importUnits({
    company
}) {

    await selectCompany(company);

    const requestXml = buildUnitRequest();

    const responseXml = await sendToTally(requestXml);
    require("fs").writeFileSync(
    "unit-response.xml",
    responseXml
    );

    const units = parseUnitResponse(responseXml);

const finalUnits = [];

for (const unit of units) {

    const objectRequest = buildUnitObjectRequest(unit.name);

    const objectResponse = await sendToTally(objectRequest);

    const fullUnit = parseUnitObjectResponse(objectResponse);

    if (fullUnit) {

        finalUnits.push(fullUnit);

    } else {

        console.warn(
            `Unit object not found: ${unit.name}`
        );

    }

}

return finalUnits;

}

module.exports = {
    importUnits
};