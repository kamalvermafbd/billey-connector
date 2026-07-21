function buildStockRequest() {

    return `
<ENVELOPE>

    <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Export</TALLYREQUEST>
        <TYPE>Collection</TYPE>
        <ID>Billey Stock Collection</ID>
    </HEADER>

    <BODY>

        <DESC>

            <STATICVARIABLES>
    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
</STATICVARIABLES>

            <TDL>

                <TDLMESSAGE>

                    <COLLECTION NAME="Billey Stock Collection">

    <TYPE>Stock Item</TYPE>

    <COMPUTE>STOCKGUID : $GUID</COMPUTE>
    <COMPUTE>STOCKMASTERID : $MASTERID</COMPUTE>
    <COMPUTE>STOCKALTERID : $ALTERID</COMPUTE>

    <FETCH>

        STOCKGUID,
        STOCKMASTERID,
        STOCKALTERID,

        NAME,
        PARENT,
        BASEUNITS,
        GSTAPPLICABLE,
        GSTTYPEOFSUPPLY,
        HSNDETAILS.LIST,
        GSTDETAILS.LIST

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
    buildStockRequest
};