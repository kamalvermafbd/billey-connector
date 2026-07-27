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
                            
                            INVENTORYENTRIESIN,
                            INVENTORYENTRIESOUT,

                        </FETCH>

                    </COLLECTION>

                </TDLMESSAGE>

            </TDL>

        </DESC>

    </BODY>

</ENVELOPE>
`;
}

function buildVoucherRequestByGuid({
    company,
    voucherGuid
}) {

    return `
<ENVELOPE>

    <HEADER>

        <VERSION>1</VERSION>

        <TALLYREQUEST>Export</TALLYREQUEST>

        <TYPE>Collection</TYPE>

        <FILTER>VoucherGuidFilter</FILTER>

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
                            
                            INVENTORYENTRIESIN,
                            INVENTORYENTRIESOUT,

                        </FETCH>

                    </COLLECTION>

                    <SYSTEM TYPE="Formulae" NAME="VoucherGuidFilter">
    $$IsEqual:$GUID:"${voucherGuid}"
</SYSTEM>

                </TDLMESSAGE>

            </TDL>

        </DESC>

    </BODY>

</ENVELOPE>
`;
}

module.exports = {
    buildVoucherRequest,
    buildVoucherRequestByGuid
};