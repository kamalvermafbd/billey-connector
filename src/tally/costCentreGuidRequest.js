function buildCostCentreGuidRequest(company) {

    return `
<ENVELOPE>

<HEADER>
<VERSION>1</VERSION>
<TALLYREQUEST>Export</TALLYREQUEST>
<TYPE>Collection</TYPE>
<ID>Billey Cost Centre GUID Collection</ID>
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

<COLLECTION NAME="Billey Cost Centre GUID Collection">

<TYPE>CostCentre</TYPE>

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
    buildCostCentreGuidRequest
};