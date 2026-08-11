function buildVoucherGuidRequest({
    company,
    fromDate,
    toDate
}) {

    return `
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

            ${
                fromDate
                    ? `<SVFROMDATE TYPE="Date">${fromDate}</SVFROMDATE>`
                    : ""
            }

            ${
                toDate
                    ? `<SVTODATE TYPE="Date">${toDate}</SVTODATE>`
                    : ""
            }

        </STATICVARIABLES>

        <TDL>

            <TDLMESSAGE>

                <COLLECTION NAME="BilleyVoucherCollection">

                    <TYPE>Voucher</TYPE>

                    <FETCH>

                        GUID,

                        ALTERID

                    </FETCH>

                </COLLECTION>

            </TDLMESSAGE>

        </TDL>

    </DESC>

</BODY>
`;
}

module.exports = {
    buildVoucherGuidRequest
};