function buildUnitRequest(company) {

    return `
<ENVELOPE>

    <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Export</TALLYREQUEST>
        <TYPE>Collection</TYPE>
        <ID>Billey Unit Collection</ID>
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

            </STATICVARIABLES>

            <TDL>

                <TDLMESSAGE>

                    <COLLECTION NAME="Billey Unit Collection">

                        <TYPE>Unit</TYPE>

                        <COMPUTE>
                            UNITGUID : $GUID
                        </COMPUTE>

                        <COMPUTE>
                            UNITMASTERID : $MASTERID
                        </COMPUTE>

                        <COMPUTE>
                            UNITALTERID : $ALTERID
                        </COMPUTE>

                        <FETCH>

                            UNITGUID,
                            UNITMASTERID,
                            UNITALTERID,

                            NAME,
                            FORMALNAME,
                            DECIMALPLACES,
                            RESERVEDNAME

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
    buildUnitRequest
};