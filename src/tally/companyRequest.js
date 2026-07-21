function buildCompanyRequest(company) {

return `
<ENVELOPE>

    <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Export</TALLYREQUEST>
        <TYPE>Object</TYPE>
        <SUBTYPE>Company</SUBTYPE>
        <ID TYPE="Name">${company}</ID>
    </HEADER>

    <BODY>

        <DESC>

            <STATICVARIABLES>
                <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
            </STATICVARIABLES>

            <FETCHLIST>

                <FETCH>NAME</FETCH>
                <FETCH>BOOKSFROM</FETCH>
                <FETCH>STARTINGFROM</FETCH>
                <FETCH>FINANCIALYEARFROM</FETCH>
                <FETCH>GUID</FETCH>

            </FETCHLIST>

        </DESC>

    </BODY>

</ENVELOPE>
`;

}

module.exports = {
    buildCompanyRequest
};