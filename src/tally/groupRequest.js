function buildGroupRequest({
    masterIds = []
}) {
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

                        <FILTER>MasterIdFilter</FILTER>

                      <FETCH>

                        NAME,
                        PARENT,
                        GUID,
                        MASTERID,
                        ALTERID,
                        RESERVEDNAME,
                        ISREVENUE,
                        ISDEEMEDPOSITIVE,
                        PARENTGUID,
                        PARENTMASTERID,
                        PARENTALTERID,

                        ISSUBLEDGER,
                        ISBILLWISEON,
                        TRACKNEGATIVEBALANCES,
                        ISCONDENSED

                    </FETCH>

                    </COLLECTION>
                    <SYSTEM TYPE="Formulae" NAME="MasterIdFilter">
                        ${masterIds
                            .map(id => `$MASTERID = ${id}`)
                            .join(" OR ")}
                    </SYSTEM>

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