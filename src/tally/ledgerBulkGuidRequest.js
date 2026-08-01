function buildLedgerBulkGuidRequest({
    company,
    ledgerGuids
}) {

    const filter = ledgerGuids
    .map(guid => `$$IsEqual:$GUID:"${guid}"`)
    .join(" OR ");

    return `
<ENVELOPE>

    <HEADER>

        <VERSION>1</VERSION>

        <TALLYREQUEST>Export</TALLYREQUEST>

        <TYPE>Collection</TYPE>

        <ID>BilleyLedgerCollection</ID>

    </HEADER>

    <BODY>

        <DESC>

            <STATICVARIABLES>

                <SVCURRENTCOMPANY>${company}</SVCURRENTCOMPANY>

                <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>

            </STATICVARIABLES>

            <TDL>

                <TDLMESSAGE>

                    <COLLECTION NAME="BilleyLedgerCollection">

                    <TYPE>Ledger</TYPE>

                    <FILTER>LedgerGuidFilter</FILTER>

                <COMPUTE>LEDGERGUID : $GUID</COMPUTE>
                <COMPUTE>LEDGERMASTERID : $MASTERID</COMPUTE>
                <COMPUTE>LEDGERALTERID : $ALTERID</COMPUTE>

                         <FETCH>

                        NAME,
                        GUID,
                        MASTERID,
                        ALTERID,

                        PARENT,
                        RESERVEDNAME,

                        GSTAPPLICABLE,
                        GSTREGISTRATIONTYPE,
                        GSTIN,

                        MAILINGNAME,
                        ADDRESS,
                        STATENAME,
                        COUNTRY,
                        PINCODE,

                        LEDGERMOBILE,
                        EMAIL,
                        CONTACTPERSON,

                        OPENINGBALANCE,
                        OPENINGBALANCEON,

                        ISBILLWISEON,
                        ISREVENUE,
                        ISDEEMEDPOSITIVE,
                        LEDGSTREGDETAILS.LIST,
                        LEDMAILINGDETAILS.LIST,
                        CONTACTDETAILS.LIST,
                        TYPEOFDUTYTAX,
                        TAXTYPE,
                        RATEOFTAXCALCULATION,
                        GSTRATE,
                        TYPEOFDUTYTAX,
                        TAXTYPE,
                        GSTDUTYHEAD,
                        RATEOFTAXCALCULATION,
                        GSTRATE,

                    </FETCH>

                    </COLLECTION>

                    <SYSTEM TYPE="Formulae" NAME="LedgerGuidFilter">
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
    buildLedgerBulkGuidRequest
};