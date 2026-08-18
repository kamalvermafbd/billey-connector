const {
    sendToTally
} = require("./src/tally/tallyService");

const fs = require("fs");

(async () => {

    const company =
        "Guru Kirpa Trading";

    try {

        const requestXml = `
<ENVELOPE>

    <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Export</TALLYREQUEST>
        <TYPE>Collection</TYPE>
        <ID>BilleyVoucherCollection</ID>
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
                    19000101
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

                    <COLLECTION NAME="BilleyVoucherCollection">

                        <TYPE>Voucher</TYPE>

                        <FETCH>
                            GUID,
                            MASTERID,
                            ALTERID,
                            DATE
                        </FETCH>

                        <FILTER>
                            VoucherAlterIdFilter
                        </FILTER>

                    </COLLECTION>

                    <SYSTEM
                        TYPE="Formulae"
                        NAME="VoucherAlterIdFilter">

                        $ALTERID = 16655

                    </SYSTEM>

                </TDLMESSAGE>

            </TDL>

        </DESC>

    </BODY>

</ENVELOPE>
`;

        fs.writeFileSync(
            "./logs/ALTERID-16655-REQUEST.xml",
            requestXml,
            "utf8"
        );

        const responseXml =
            await sendToTally(requestXml);

        fs.writeFileSync(
            "./logs/ALTERID-16655-RESPONSE.xml",
            String(responseXml || ""),
            "utf8"
        );

        console.log(
            "RESPONSE BYTES:",
            Buffer.byteLength(
                String(responseXml || ""),
                "utf8"
            )
        );

        console.log(
            "HAS VOUCHER:",
            String(responseXml || "")
                .includes("<VOUCHER>")
        );

    } catch (err) {

        fs.writeFileSync(
            "./logs/ALTERID-16655-ERROR.txt",
            err.stack || String(err),
            "utf8"
        );

        process.exitCode = 1;
    }

})();