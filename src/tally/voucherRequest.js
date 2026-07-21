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

                <SVFROMDATE TYPE="Date">${fromDate}</SVFROMDATE>

                <SVTODATE TYPE="Date">${toDate}</SVTODATE>

            </STATICVARIABLES>

            <TDL>

                <TDLMESSAGE>

                    <COLLECTION NAME="BilleyVoucherCollection">

                        <TYPE>Voucher</TYPE>

                        <FETCH>

                            GUID,

                            MASTERID,

                            ALTERID,

                            DATE,

                            EFFECTIVEDATE,

                            VOUCHERTYPENAME,

                            VOUCHERNUMBER,

                            REFERENCE,

                            REFERENCEDATE,

                            PARTYLEDGERNAME,

                            NARRATION,

                            PARTYGSTIN,

                            PLACEOFSUPPLY,

                            BASICBUYERNAME,

                            BASICBUYERADDRESS,

                            GSTREGISTRATIONTYPE,

                            PERSISTEDVIEW,

                            ISINVOICE,

                            ISOPTIONAL,

                            ISCANCELLED,

                            ALLLEDGERENTRIES,

                            ALLINVENTORYENTRIES,
                            

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