function buildVoucherBulkGuidRequest({
    company,
    voucherGuids,
    fromDate = "20260401",
    toDate = "20270331"
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
<SVFROMDATE TYPE="Date">${fromDate}</SVFROMDATE>
<SVTODATE TYPE="Date">${toDate}</SVTODATE>

            </STATICVARIABLES>

            <TDL>

                <TDLMESSAGE>

                    <COLLECTION NAME="BilleyVoucherCollection">

                      <FILTER>VoucherGuidFilter</FILTER>

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