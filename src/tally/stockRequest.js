function buildStockRequest({
    company,
    lastStockAlterId = null
}) {
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
            <SVCURRENTCOMPANY>${company}</SVCURRENTCOMPANY>
    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
</STATICVARIABLES>

            <TDL>

                <TDLMESSAGE>

                    <COLLECTION NAME="Billey Stock Collection">

    <TYPE>Stock Item</TYPE>

    ${lastStockAlterId !== null
    ? `<FILTER>StockAlterIdFilter</FILTER>`
    : ""}

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
        GSTDETAILS.LIST,
        PARENTGUID,
        PARENTMASTERID,
        PARENTALTERID

    </FETCH>

</COLLECTION>

${lastStockAlterId !== null
? `
<SYSTEM TYPE="Formulae" NAME="StockAlterIdFilter">
    $ALTERID &gt; ${lastStockAlterId}
</SYSTEM>
`
: ""}

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