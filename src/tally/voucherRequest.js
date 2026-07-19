function buildVoucherRequest({
    company,
    fromDate,
    toDate
}) {

    return `
<ENVELOPE>

    <HEADER>

        <VERSION>1</VERSION>

        <TALLYREQUEST>Export</TALLYREQUEST>

        <TYPE>Collection</TYPE>

        <ID>BilleyVoucherCollection</ID>

    </HEADER>

    <BODY>

        <DESC>

            <STATICVARIABLES>

                <SVCURRENTCOMPANY>${company}</SVCURRENTCOMPANY>

                <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>

            </STATICVARIABLES>

            <TDL>

                <TDLMESSAGE>

                    <COLLECTION NAME="BilleyVoucherCollection">

                        <TYPE>Voucher</TYPE>

                        <FETCH>

                            Date,
                            VoucherTypeName,
                            VoucherNumber,
                            PartyLedgerName,
                            Narration,
                            AllInventoryEntries,
                            LedgerEntries,
                            PartyGSTIN,
                            PlaceOfSupply,
                            BasicBuyerName,
                            BasicBuyerAddress,
                            GSTRegistrationType,
                            PersistedView

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
    buildVoucherRequest
};