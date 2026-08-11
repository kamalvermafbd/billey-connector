function buildVoucherBulkGuidRequest({
    company,
    voucherGuids
}) {

    const filter = voucherGuids
        .map(guid => `$$IsEqual:$GUID:"${guid}"`)
        .join(" OR ");

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

                        <FILTER>VoucherGuidFilter</FILTER>

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

                            INVENTORYENTRIESOUT

                        </FETCH>

                    </COLLECTION>

                    <SYSTEM TYPE="Formulae" NAME="VoucherGuidFilter">
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
    buildVoucherBulkGuidRequest
};