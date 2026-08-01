function buildStockBulkGuidRequest({
    company,
    stockGuids
}) {

    const filter = stockGuids
    .map(guid => `$$IsEqual:$GUID:"${guid}"`)
    .join(" OR ");

    return `
<ENVELOPE>

    <HEADER>

        <VERSION>1</VERSION>

        <TALLYREQUEST>Export</TALLYREQUEST>

        <TYPE>Collection</TYPE>

        <ID>BilleyStockCollection</ID>

    </HEADER>

    <BODY>

        <DESC>

            <STATICVARIABLES>

                <SVCURRENTCOMPANY>${company}</SVCURRENTCOMPANY>

                <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>

            </STATICVARIABLES>

            <TDL>

                <TDLMESSAGE>

                    <COLLECTION NAME="BilleyStockCollection">

    <TYPE>Stock Item</TYPE>

    <FILTER>StockGuidFilter</FILTER>

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

                    <SYSTEM TYPE="Formulae" NAME="StockGuidFilter">
                        ${filter}
                    </SYSTEM>

                </TDLMESSAGE>

            </TDL>

        </DESC>

    </BODY>

</ENVELOPE>
`;

}

module.exports = {
    buildStockBulkGuidRequest
};