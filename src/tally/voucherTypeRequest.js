function buildVoucherTypeRequest() {

    return `
<ENVELOPE>

    <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Export</TALLYREQUEST>
        <TYPE>Collection</TYPE>
        <ID>Billey Voucher Type Collection</ID>
    </HEADER>

    <BODY>

        <DESC>

            <STATICVARIABLES>

                <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>

            </STATICVARIABLES>

            <TDL>

                <TDLMESSAGE>

                    <COLLECTION NAME="Billey Voucher Type Collection">

                        <TYPE>VoucherType</TYPE>

                        <FETCH>

                         NAME,
                            PARENT,
                            RESERVEDNAME,

                            NUMBERINGMETHOD,

                            USEZEROENTRIES,

                            ISOPTIONAL,

                            COMMONNARRATION,

                            PRINTAFTERSAVE,

                            ISDEFAULTALLOCENABLED,

                            ISACTIVE

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
    buildVoucherTypeRequest
};