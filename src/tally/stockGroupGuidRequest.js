function buildStockGroupGuidRequest() {

    return `
<ENVELOPE>

<HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>Billey Stock Group GUID Collection</ID>
</HEADER>


<BODY>

<DESC>

<STATICVARIABLES>

    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>

</STATICVARIABLES>


<TDL>

<TDLMESSAGE>


<COLLECTION NAME="Billey Stock Group GUID Collection">


    <TYPE>Stock Group</TYPE>


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
    buildStockGroupGuidRequest
};