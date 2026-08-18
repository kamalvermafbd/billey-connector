function buildDeletedVoucherAlterIdTestRequest({
    company,
    lastAlterId,
    booksBeginningDate = 20210401,
    toDate = 20991231
}) {

    return `
<ENVELOPE>

    <HEADER>

        <VERSION>1</VERSION>

        <TALLYREQUEST>Export</TALLYREQUEST>

        <TYPE>Collection</TYPE>

        <ID>BooksBeginningAlterIdTestCollection</ID>

    </HEADER>

    <BODY>

        <DESC>

            <STATICVARIABLES>

                <SVCURRENTCOMPANY>
                    ${company}
                </SVCURRENTCOMPANY>

                <SVFROMDATE TYPE="Date">
                    ${Number(booksBeginningDate)}
                </SVFROMDATE>

                <SVTODATE TYPE="Date">
                    ${Number(toDate)}
                </SVTODATE>

                <SVEXPORTFORMAT>
                    $$SysName:XML
                </SVEXPORTFORMAT>

            </STATICVARIABLES>

            <TDL>

                <TDLMESSAGE>

                    <COLLECTION NAME="BooksBeginningAlterIdTestCollection">

                        <TYPE>Voucher</TYPE>

                        <FILTER>
                            BooksBeginningAlterIdFilter
                        </FILTER>

                        <FETCH>

                            MASTERID,
                            GUID,
                            ALTERID,
                            DATE,
                            VOUCHERTYPENAME,
                            VOUCHERNUMBER,
                            ISDELETED

                        </FETCH>

                    </COLLECTION>


                    <SYSTEM
                        TYPE="Formulae"
                        NAME="BooksBeginningAlterIdFilter">

                        $ALTERID > ${Number(lastAlterId)}

                    </SYSTEM>

                </TDLMESSAGE>

            </TDL>

        </DESC>

    </BODY>

</ENVELOPE>
`;
}

module.exports = {
    buildDeletedVoucherAlterIdTestRequest
};