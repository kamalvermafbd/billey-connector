const {sendToTally,selectCompany}=require("./tallyService");
const {buildGodownGuidRequest}=require("./godownGuidRequest");
const {parseGodownGuidResponse}=require("./godownGuidParser");
async function importGodownGuids({company}){
await selectCompany(company);
return parseGodownGuidResponse(await sendToTally(buildGodownGuidRequest()));
}
module.exports={importGodownGuids};
