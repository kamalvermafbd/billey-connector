// ==========================================
// BUILD STOCK SUMMARY REQUEST
// ==========================================

function buildStockSummaryRequest({
    company,
    booksBeginningFrom
}) {

    return `
<ENVELOPE>

    <HEADER>

        <VERSION>1</VERSION>

        <TALLYREQUEST>Export</TALLYREQUEST>

        <TYPE>Data</TYPE>

        <ID>Stock Summary</ID>

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


                <EXPLODEFLAG>
                    Yes
                </EXPLODEFLAG>


                <ISITEMWISE>
                    Yes
                </ISITEMWISE>


                <SHOWGODOWN>
                    Yes
                </SHOWGODOWN>


                <SHOWBATCHES>
                    Yes
                </SHOWBATCHES>


                <SVFROMDATE TYPE="Date">
                    ${booksBeginningFrom}
                </SVFROMDATE>


                <SVTODATE TYPE="Date">
                    20991231
                </SVTODATE>


                <SVCURRENTDATE TYPE="Date">
                    20991231
                </SVCURRENTDATE>

            </STATICVARIABLES>


            <TDL>

                <TDLMESSAGE>

                    <REPORT NAME="Stock Summary">

                        <VARIABLE>
                            EXPLODEFLAG,
                            SHOWGODOWN,
                            ISITEMWISE
                        </VARIABLE>


                        <SET>
                            EXPLODEFLAG : Yes
                        </SET>


                        <SET>
                            SHOWGODOWN : Yes
                        </SET>


                        <SET>
                            ISITEMWISE : Yes
                        </SET>

                    </REPORT>

                </TDLMESSAGE>

            </TDL>

        </DESC>

    </BODY>

</ENVELOPE>
`;
}


module.exports = {
    buildStockSummaryRequest
};