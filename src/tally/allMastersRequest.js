function buildAllMastersRequest() {

    return `
<ENVELOPE>

    <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Export</TALLYREQUEST>
        <TYPE>Data</TYPE>
        <ID>All Masters</ID>
    </HEADER>

    <BODY>

        <DESC>

            <STATICVARIABLES>

                <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>

            </STATICVARIABLES>

            <REPORTNAME>All Masters</REPORTNAME>

        </DESC>

    </BODY>

</ENVELOPE>
`;
}

module.exports = {
    buildAllMastersRequest
};