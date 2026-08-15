function buildUnitGuidRequest(company) {

    return `
<ENVELOPE>

<HEADER>
<VERSION>1</VERSION>
<TALLYREQUEST>Export</TALLYREQUEST>
<TYPE>Collection</TYPE>
<ID>Billey Unit GUID Collection</ID>
</HEADER>

<BODY>

<DESC>

<STATICVARIABLES>

<SVCURRENTCOMPANY>
    ${company}
</SVCURRENTCOMPANY>

<SVEXPORTFORMAT>
    $$SysName:XML
</SVEXPORTFORMAT>

</STATICVARIABLES>

<TDL>

<TDLMESSAGE>

<COLLECTION NAME="Billey Unit GUID Collection">

<TYPE>Unit</TYPE>

<FETCH>
GUID,
MASTERID,
ALTERID
</FETCH>

</COLLECTION>

</TDLMESSAGE>

</TDL>

</DESC>

</BODY>

</ENVELOPE>
`;
}

module.exports = {
    buildUnitGuidRequest
};