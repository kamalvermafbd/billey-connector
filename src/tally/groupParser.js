const { XMLParser } = require("fast-xml-parser");
 const fs = require("fs");

function getValue(node) {

    if (node == null) return "";

    if (typeof node === "string")
        return node.trim();

    if (typeof node === "number")
        return node;

    if (typeof node === "boolean")
        return node;

    if (typeof node === "object" && "#text" in node)
        return String(node["#text"]).trim();

    return "";

}

function parseGroupResponse(xml) {

    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "",
        parseTagValue: true,
        trimValues: true
    });

    const json = parser.parse(xml);

    const groups =
        json?.ENVELOPE?.BODY?.DATA?.COLLECTION?.GROUP || [];

    const groupList = Array.isArray(groups)
        ? groups
        : [groups];

    
/* 240926
    return groupList.map(group => ({

     guid: getValue(group.GUID),

masterId: getValue(group.MASTERID) || null,

alterId: getValue(group.ALTERID) || null,

parentGuid: getValue(group.PARENTGUID) || null,

parentMasterId: getValue(group.PARENTMASTERID) || null,

parentAlterId: getValue(group.PARENTALTERID) || null,

        name: getValue(group.NAME),

        parent: getValue(group.PARENT),

        reservedName: getValue(group.RESERVEDNAME),

        isRevenue:
            String(getValue(group.ISREVENUE)).toUpperCase() === "YES",

        isDeemedPositive:
            String(getValue(group.ISDEEMEDPOSITIVE)).toUpperCase() === "YES",

            isSubledger:
    String(getValue(group.ISSUBLEDGER)).toUpperCase() === "YES",

isBillwiseOn:
    String(getValue(group.ISBILLWISEON)).toUpperCase() === "YES",

trackNegativeBalances:
    String(getValue(group.TRACKNEGATIVEBALANCES)).toUpperCase() === "YES",

isCondensed:
    String(getValue(group.ISCONDENSED)).toUpperCase() === "YES",

        raw: group

    }));
    */

const normalizedGroups = groupList.map(group => ({
    guid: getValue(group.GUID),

    masterId: getValue(group.MASTERID) || null,

    alterId: getValue(group.ALTERID) || null,

    parentGuid: getValue(group.PARENTGUID) || null,

    parentMasterId: getValue(group.PARENTMASTERID) || null,

    parentAlterId: getValue(group.PARENTALTERID) || null,

    name: getValue(group.NAME),

    parent: getValue(group.PARENT),

    reservedName: getValue(group.RESERVEDNAME),

    isRevenue:
        String(getValue(group.ISREVENUE)).toUpperCase() === "YES",

    isDeemedPositive:
        String(getValue(group.ISDEEMEDPOSITIVE)).toUpperCase() === "YES",

    isSubledger:
        String(getValue(group.ISSUBLEDGER)).toUpperCase() === "YES",

    isBillwiseOn:
        String(getValue(group.ISBILLWISEON)).toUpperCase() === "YES",

    trackNegativeBalances:
        String(getValue(group.TRACKNEGATIVEBALANCES)).toUpperCase() === "YES",

    isCondensed:
        String(getValue(group.ISCONDENSED)).toUpperCase() === "YES",

    raw: group
}));


// ============================================================
// FALLBACK PARENT GUID RESOLUTION
// Tally may return PARENT but not PARENTGUID.
// Resolve parent GUID from the same response batch.
// ============================================================

const groupGuidByName = new Map();

for (const group of normalizedGroups) {

    const name =
        String(group.name || "")
            .replace(/\u0004/g, "")
            .trim();

    const guid =
        String(group.guid || "")
            .trim();

    if (!name || !guid) continue;

    groupGuidByName.set(name, guid);
}


// Resolve missing parentGuid using parent name

for (const group of normalizedGroups) {

    if (group.parentGuid) continue;

    const parentName =
        String(group.parent || "")
            .replace(/\u0004/g, "")
            .trim();

    if (!parentName || parentName === "Primary") {
        group.parentGuid = null;
        continue;
    }

    group.parentGuid =
        groupGuidByName.get(parentName) || null;
}


return normalizedGroups;

}

module.exports = {
    parseGroupResponse
};