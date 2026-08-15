function buildLedgerRequest({
    company,
    booksBeginningFrom,
    lastLedgerAlterId = null,
    masterIds = []
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

                <SVCURRENTCOMPANY>
                    ${company}
                </SVCURRENTCOMPANY>

                <SVEXPORTFORMAT>
                    $$SysName:XML
                </SVEXPORTFORMAT>

                <SVFROMDATE TYPE="Date">
                    ${booksBeginningFrom}
                </SVFROMDATE>

                <SVTODATE TYPE="Date">
                    ${booksBeginningFrom}
                </SVTODATE>

            </STATICVARIABLES>

            <TDL>

                <TDLMESSAGE>

                    <COLLECTION NAME="Billey Ledger Collection">

                        <TYPE>Ledger</TYPE>

                        ${
                            masterIds.length
                            ? `<FILTER>LedgerMasterIdFilter</FILTER>`
                            : lastLedgerAlterId !== null
                                ? `<FILTER>LedgerAlterIdFilter</FILTER>`
                                : ""
                        }

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
                            GSTDUTYHEAD,
                            RATEOFTAXCALCULATION,
                            GSTRATE,

                            PARENTGUID,
                            PARENTMASTERID,
                            PARENTALTERID

                        </FETCH>

                        <COMPUTE>
                            ORIGINALOPENINGBALANCE : $_OpeningBalance
                        </COMPUTE>

                    </COLLECTION>

                    ${
                        masterIds.length
                        ? `
                        <SYSTEM TYPE="Formulae" NAME="LedgerMasterIdFilter">
                            ${masterIds
                                .map(id => `$MASTERID = ${id}`)
                                .join(" OR ")}
                        </SYSTEM>
                        `
                        : lastLedgerAlterId !== null
                            ? `
                            <SYSTEM TYPE="Formulae" NAME="LedgerAlterIdFilter">
                                $ALTERID > ${lastLedgerAlterId}
                            </SYSTEM>
                            `
                            : ""
                    }

                </TDLMESSAGE>

            </TDL>

        </DESC>

    </BODY>

</ENVELOPE>
`;

    console.log(
        "================================"
    );

    console.log(
        "booksBeginningFrom:",
        booksBeginningFrom
    );

    console.log(
        "================================"
    );

    return xml;
}

module.exports = {
    buildLedgerRequest
};