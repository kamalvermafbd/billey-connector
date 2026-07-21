function buildStockGroupRequest() {

    return `
<ENVELOPE>

    <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Export</TALLYREQUEST>
        <TYPE>Collection</TYPE>
        <ID>Billey Stock Group Collection</ID>
    </HEADER>

    <BODY>

        <DESC>

            <STATICVARIABLES>
                <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
            </STATICVARIABLES>

            <TDL>

                <TDLMESSAGE>

                    <COLLECTION NAME="Billey Stock Group Collection">

                        <TYPE>Stock Group</TYPE>

                        <COMPUTE>GROUPGUID : $GUID</COMPUTE>
                        <COMPUTE>GROUPMASTERID : $MASTERID</COMPUTE>
                        <COMPUTE>GROUPALTERID : $ALTERID</COMPUTE>

                        <FETCH>

                            GROUPGUID,
                            GROUPMASTERID,
                            GROUPALTERID,

                            NAME,
                            PARENT,
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
    buildStockGroupRequest
};