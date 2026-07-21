function buildLedgerRequest({
    booksBeginningFrom
}) {
const xml = `
<ENVELOPE>

    <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Export</TALLYREQUEST>
        <TYPE>Collection</TYPE>
        <ID>Billey Ledger Collection</ID>
    </HEADER>

    <BODY>

        <DESC>

          <STATICVARIABLES>

    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>

  <SVFROMDATE TYPE="Date">${booksBeginningFrom}</SVFROMDATE>
<SVTODATE TYPE="Date">${booksBeginningFrom}</SVTODATE>

</STATICVARIABLES>

            <TDL>

                <TDLMESSAGE>

                    <COLLECTION NAME="Billey Ledger Collection">

                        <TYPE>Ledger</TYPE>

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
    CONTACTDETAILS.LIST

</FETCH>

<COMPUTE>
    ORIGINALOPENINGBALANCE : $_OpeningBalance
</COMPUTE>

                    </COLLECTION>

                </TDLMESSAGE>

            </TDL>

        </DESC>

    </BODY>

</ENVELOPE>
`;

console.log("================================");
console.log("booksBeginningFrom:", booksBeginningFrom);
console.log("================================");
console.log(xml);

return xml;

}

module.exports = {
    buildLedgerRequest
};