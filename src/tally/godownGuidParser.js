const {XMLParser}=require("fast-xml-parser");
function getValue(node){
if(node==null)return "";
if(typeof node==="string")return node.trim();
if(typeof node==="number")return String(node);
if(typeof node==="object" && "#text" in node)return String(node["#text"]).trim();
return "";
}
function parseGodownGuidResponse(xml){
const json=new XMLParser({ignoreAttributes:false,parseTagValue:true,trimValues:true}).parse(xml);
const godowns=json?.ENVELOPE?.BODY?.DATA?.COLLECTION?.GODOWN||[];
const list=Array.isArray(godowns)?godowns:[godowns];
return list.map(g=>({guid:getValue(g.GUID),masterId:getValue(g.MASTERID),alterId:getValue(g.ALTERID)}));
}
module.exports={parseGodownGuidResponse};
