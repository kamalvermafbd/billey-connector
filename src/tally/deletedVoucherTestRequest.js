function buildDeletedVoucherTestRequest({
    company
}) {

    return `
<ENVELOPE>

    <HEADER>

        <VERSION>1</VERSION>

        <TALLYREQUEST>Export</TALLYREQUEST>

        <TYPE>Collection</TYPE>

        <ID>DeletedVoucherTestCollection</ID>

    </HEADER>

    <BODY>

        <DESC>

            <STATICVARIABLES>

                <SVCURRENTCOMPANY>${company}</SVCURRENTCOMPANY>

                <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>

            </STATICVARIABLES>

            <TDL>

                <TDLMESSAGE>

                    <COLLECTION NAME="DeletedVoucherTestCollection">

                        <TYPE>Voucher</TYPE>

                         <INCLUDEDELETED>Yes</INCLUDEDELETED>

                        <FETCH>

                            GUID,
                            MASTERID,
                            ALTERID,
                            ISDELETED

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
    buildDeletedVoucherTestRequest
};