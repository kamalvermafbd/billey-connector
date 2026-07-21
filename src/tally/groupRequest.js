function buildGroupRequest() {

    return `
<ENVELOPE>

    <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Export</TALLYREQUEST>
        <TYPE>Collection</TYPE>
        <ID>Billey Group Collection</ID>
    </HEADER>

    <BODY>

        <DESC>

            <STATICVARIABLES>

                <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>

            </STATICVARIABLES>

            <TDL>

                <TDLMESSAGE>

                    <COLLECTION NAME="Billey Group Collection">

                        <TYPE>Group</TYPE>

                      <FETCH>

    NAME,
    PARENT,
    GUID,
    MASTERID,
    ALTERID,
    RESERVEDNAME,
    ISREVENUE,
    ISDEEMEDPOSITIVE

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
    buildGroupRequest
};