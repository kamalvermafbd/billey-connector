function buildUnitObjectRequest(name) {
    return `
<ENVELOPE>
    <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Export</TALLYREQUEST>
        <TYPE>Object</TYPE>
        <SUBTYPE>Unit</SUBTYPE>
        <ID TYPE="Name">${name}</ID>
    </HEADER>

    <BODY>
        <DESC>
            <STATICVARIABLES>
                <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
            </STATICVARIABLES>

            <FETCHLIST>
                <FETCH>GUID</FETCH>
                <FETCH>ALTERID</FETCH>
                <FETCH>MASTERID</FETCH>
                <FETCH>NAME</FETCH>
            </FETCHLIST>
        </DESC>
    </BODY>
</ENVELOPE>
`;
}

module.exports = { buildUnitObjectRequest };