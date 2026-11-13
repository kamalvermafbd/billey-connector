"use strict";

const {
    buildLedgerBulkGuidRequest
} = require("../tally/ledgerBulkGuidRequest");

const {
    buildLedgerRequest
} = require("../tally/ledgerRequest");

const {
    buildVoucherBulkGuidRequest
} = require("../tally/voucherBulkGuidRequest");


const {
    parseReconciliationVoucherXml,
    buildReconciliationLedgerLookups,
    collectionRows
} = require("./parseReconciliationVoucherXml");

const {
    sendToTally,
    selectCompany
} = require("../tally/tallyService");

const {
    runReconciliationTallyOperation
} = require("../tally/tallyRequestQueue");

const {
    XMLParser,
    XMLValidator
} = require("fast-xml-parser");

const reconcileXmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    parseTagValue: false,
    trimValues: true
});

// ==============================================
// RECONCILE NOW — STRICT LEDGER OPENING VALIDATION
// ==============================================

const reconciliationCompanyXmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
    processEntities: true
});


function validateLedgerOpeningBalance(ledger, expectedGuid) {
    const guid = String(expectedGuid || "").trim();

    if (!guid) {
        throw new Error("RECONCILE_LEDGER_GUID_REQUIRED");
    }

    if (!ledger || typeof ledger !== "object") {
        throw new Error("RECONCILE_LEDGER_RESPONSE_INVALID");
    }

    const actualGuid = String(
        ledger.GUID?.["#text"] ?? ledger.GUID ?? ""
    ).trim();

    if (actualGuid !== guid) {
        throw new Error("RECONCILE_LEDGER_GUID_MISMATCH");
    }

    if (!Object.prototype.hasOwnProperty.call(
        ledger,
        "OPENINGBALANCE"
    )) {
        throw new Error("RECONCILE_OPENING_BALANCE_MISSING");
    }

    const raw = ledger.OPENINGBALANCE?.["#text"]
        ?? ledger.OPENINGBALANCE;

        const value = String(raw ?? "").trim();

    if (
    !value ||
    !/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)
) {
    throw new Error("RECONCILE_OPENING_BALANCE_INVALID");
}

    const negative = value.startsWith("-");
    const unsigned = value.replace(/^[+-]/, "");

    const parts = unsigned.split(".");
    const integerPart = (parts[0] || "0").replace(/^0+(?=\d)/, "");
    const fractionalPart = parts[1] || "";

   const isZero =
    /^0*$/.test(integerPart) &&
    /^0*$/.test(fractionalPart);

    const normalizedAmount =
        integerPart +
        (fractionalPart ? "." + fractionalPart : "");

    return {
        guid,
        openingBalance: normalizedAmount,
        openingBalanceType: isZero
            ? ""
            : negative
                ? "DR"
                : "CR"
    };
}
async function fetchLedgerOpeningBalance({
    company,
    ledgerGuid,
    booksBeginningFrom
}) {
    const guid = String(ledgerGuid || "").trim();

    if (!String(company || "").trim()) {
        throw new Error("RECONCILE_COMPANY_REQUIRED");
    }

    if (!guid) {
        throw new Error("RECONCILE_LEDGER_GUID_REQUIRED");
    }

    if (
        typeof booksBeginningFrom !== "string" ||
        !/^\d{8}$/.test(booksBeginningFrom)
    ) {
        throw new Error("RECONCILE_BOOKS_BEGINNING_DATE_INVALID");
    }

    const xml = buildLedgerBulkGuidRequest({
        company,
        ledgerGuids: [guid],
        booksBeginningFrom
    });

    await selectCompany(company);

    const response = await sendToTally(xml);

    if (typeof response !== "string" || !response.trim()) {
        throw new Error("RECONCILE_TALLY_RESPONSE_EMPTY");
    }

    const parsed = reconcileXmlParser.parse(response);

    const collection =
        parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION;

    if (!collection || typeof collection !== "object") {
        throw new Error("RECONCILE_LEDGER_COLLECTION_MISSING");
    }

    const rawLedgers = collection.LEDGER;

    const ledgers = Array.isArray(rawLedgers)
        ? rawLedgers
        : rawLedgers
            ? [rawLedgers]
            : [];

    if (ledgers.length !== 1) {
        throw new Error("RECONCILE_LEDGER_RESULT_COUNT_INVALID");
    }

    return validateLedgerOpeningBalance(
        ledgers[0],
        guid
    );
}


function validateReconciliationVoucherRequest({
    company,
    voucherGuids,
    fromDate,
    toDate
}) {
    if (
        typeof company !== "string" ||
        !company.trim() ||
        /[<>&"'[\]\r\n]/.test(company)
    ) {
        throw new Error(
            "RECONCILE_VOUCHER_COMPANY_INVALID"
        );
    }

    if (
        !Array.isArray(voucherGuids) ||
        voucherGuids.length === 0
    ) {
        throw new Error(
            "RECONCILE_VOUCHER_GUIDS_INVALID"
        );
    }

   
    const normalizedGuids = voucherGuids.map(value => {
        if (
            typeof value !== "string" ||
            !/^[A-Za-z0-9][A-Za-z0-9-]{0,127}$/.test(value)
        ) {
            throw new Error(
                "RECONCILE_VOUCHER_GUID_INVALID"
            );
        }

        return value.toLowerCase();
    });


    if (
        new Set(
            normalizedGuids.map(guid => guid.toLowerCase())
        ).size !== normalizedGuids.length
    ) {
        throw new Error(
            "RECONCILE_VOUCHER_GUID_DUPLICATE"
        );
    }

    
    const validDate = value => {
        if (
            typeof value !== "string" ||
            !/^\d{8}$/.test(value)
        ) {
            return false;
        }

        const year = Number(value.slice(0, 4));
        const month = Number(value.slice(4, 6));
        const day = Number(value.slice(6, 8));

        if (
            year < 1 ||
            month < 1 ||
            month > 12 ||
            day < 1
        ) {
            return false;
        }

        const leapYear =
            year % 4 === 0 &&
            (year % 100 !== 0 || year % 400 === 0);

        const daysInMonth = [
            31,
            leapYear ? 29 : 28,
            31, 30, 31, 30,
            31, 31, 30, 31,
            30, 31
        ];

        return day <= daysInMonth[month - 1];
    };


    if (
        !validDate(fromDate) ||
        !validDate(toDate) ||
        fromDate > toDate
    ) {
        throw new Error(
            "RECONCILE_VOUCHER_DATE_RANGE_INVALID"
        );
    }

    return {
        company: company.trim(),
        voucherGuids: normalizedGuids,
        fromDate,
        toDate
    };
}

function buildValidatedReconciliationVoucherRequest(input) {
    const validated = validateReconciliationVoucherRequest(input);

    const xml = buildVoucherBulkGuidRequest(validated);

    if (
        typeof xml !== "string" ||
        !xml.trim() ||
        xml.includes("<!DOCTYPE") ||
        xml.includes("<!ENTITY")
    ) {
        throw new Error(
            "RECONCILE_VOUCHER_REQUEST_XML_INVALID"
        );
    }

    return {
        ...validated,
        xml
    };
}

function parseValidatedReconciliationVouchers({
    responseXml,
    request,
    lookups,
    companyCode,
    tallyOwner
}) {
    if (
        !request ||
        !Array.isArray(request.voucherGuids) ||
        typeof request.xml !== "string" ||
        !lookups ||
        !(lookups.ledgerLookup instanceof Map) ||
        typeof companyCode !== "string" ||
        !companyCode.trim() ||
        !["USER", "CA"].includes(tallyOwner)
    ) {
        throw new Error(
            "RECONCILE_VOUCHER_CONTEXT_INVALID"
        );
    }

    return parseReconciliationVoucherXml({
        responseXml,
        requestedGuids: request.voucherGuids,
        lookups,
        companyCode,
        tallyOwner
    });
}


async function runReconciliationWithFifo(operation) {
    if (typeof operation !== "function") {
        throw new TypeError(
            "RECONCILE_OPERATION_INVALID"
        );
    }

    return runReconciliationTallyOperation(
        async control => {
            control.assertActive();

            const result = await operation(control);

            control.assertActive();

            return result;
        }
    );
}

function parseFreshReconciliationLedgerLookups(responseXml) {
    if (
        typeof responseXml !== "string" ||
        !responseXml.trim()
    ) {
        throw new Error(
            "RECONCILE_LEDGER_RESPONSE_EMPTY"
        );
    }

    const ledgers = collectionRows(responseXml, "LEDGER");

   
    for (const ledger of ledgers) {
        if (
            !ledger ||
            typeof ledger !== "object" ||
            Array.isArray(ledger)
        ) {
            throw new Error(
                "RECONCILE_LEDGER_IDENTITY_INCOMPLETE"
            );
        }

        for (const field of [
            "NAME",
            "GUID",
            "MASTERID",
            "ALTERID"
        ]) {
            const value = ledger[field];

            if (
                typeof value !== "string" ||
                !value.trim()
            ) {
                throw new Error(
                    "RECONCILE_LEDGER_IDENTITY_INCOMPLETE"
                );
            }
        }
    }


    return buildReconciliationLedgerLookups(ledgers);
}

function buildFreshReconciliationLedgerRequest({
    company,
    booksBeginningFrom
}) {
    if (
        typeof company !== "string" ||
        !company.trim() ||
        /[<>&"'\r\n]/.test(company)
    ) {
        throw new Error(
            "RECONCILE_LEDGER_COMPANY_INVALID"
        );
    }

    if (
        typeof booksBeginningFrom !== "string" ||
        !/^\d{8}$/.test(booksBeginningFrom)
    ) {
        throw new Error(
            "RECONCILE_LEDGER_DATE_INVALID"
        );
    }

    const xml = buildLedgerRequest({
        company: company.trim(),
        booksBeginningFrom,
        masterIds: [],
        lastLedgerAlterId: null
    });

    if (
        typeof xml !== "string" ||
        !xml.includes(
            '<COLLECTION NAME="Billey Ledger Collection">'
        ) ||
        xml.includes("<FILTER>")
    ) {
        throw new Error(
            "RECONCILE_LEDGER_REQUEST_INVALID"
        );
    }

    return xml;
}

function buildReconciliationCompanyRequest(company) {
    if (
        typeof company !== "string" ||
        !company.trim() ||
        /[\u0000-\u001F\u007F]/.test(company)
    ) {
        throw new Error(
            "RECONCILE_COMPANY_NAME_INVALID"
        );
    }

    const escapedCompany = company.trim()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

    return `
<ENVELOPE>
    <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Export</TALLYREQUEST>
        <TYPE>Object</TYPE>
        <SUBTYPE>Company</SUBTYPE>
        <ID TYPE="Name">${escapedCompany}</ID>
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
</ENVELOPE>`;
}

function validateReconciliationBooksBeginningFrom(value) {
    if (
        typeof value !== "string" ||
        !/^\d{8}$/.test(value)
    ) {
        throw new Error(
            "RECONCILE_BOOKSFROM_INVALID"
        );
    }

    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(4, 6));
    const day = Number(value.slice(6, 8));

    if (
        year < 1 ||
        month < 1 ||
        month > 12 ||
        day < 1
    ) {
        throw new Error(
            "RECONCILE_BOOKSFROM_INVALID"
        );
    }

    const leapYear =
        year % 4 === 0 &&
        (year % 100 !== 0 || year % 400 === 0);

    const daysInMonth = [
        31,
        leapYear ? 29 : 28,
        31, 30, 31, 30,
        31, 31, 30, 31,
        30, 31
    ];

    if (day > daysInMonth[month - 1]) {
        throw new Error(
            "RECONCILE_BOOKSFROM_INVALID"
        );
    }

    return value;
}

function readReconciliationCompanyField(company, field) {
    if (
        !company ||
        typeof company !== "object" ||
        Array.isArray(company)
    ) {
        throw new Error(
            "RECONCILE_COMPANY_OBJECT_INVALID"
        );
    }

    const raw = company[field];

    if (typeof raw === "string" && raw.trim()) {
        return raw.trim();
    }

    if (
        raw &&
        typeof raw === "object" &&
        !Array.isArray(raw) &&
        typeof raw["#text"] === "string" &&
        raw["#text"].trim() &&
        Object.keys(raw).every(
            key => key === "#text" || key.startsWith("@_")
        )
    ) {
        return raw["#text"].trim();
    }

    throw new Error(
        `RECONCILE_COMPANY_FIELD_INVALID:${field}`
    );
}


function validateReconciliationCompanyResponse({
    responseXml,
    expectedCompanyGuid,
    expectedCompanyName
}) {
    if (
        typeof responseXml !== "string" ||
        !responseXml.trim() ||
        /<!\s*(?:DOCTYPE|ENTITY)\b/i.test(responseXml) ||
        XMLValidator.validate(responseXml) !== true
    ) {
        throw new Error("RECONCILE_COMPANY_XML_INVALID");
    }

    if (
        typeof expectedCompanyGuid !== "string" ||
        !expectedCompanyGuid.trim() ||
        typeof expectedCompanyName !== "string" ||
        !expectedCompanyName.trim()
    ) {
        throw new Error("RECONCILE_COMPANY_CONTEXT_INVALID");
    }

    const parsed =
        reconciliationCompanyXmlParser.parse(responseXml);

    const envelope = parsed?.ENVELOPE;

    if (
        !envelope ||
        typeof envelope !== "object" ||
        Array.isArray(envelope)
    ) {
        throw new Error("RECONCILE_COMPANY_ENVELOPE_INVALID");
    }

    const header = envelope.HEADER;

    if (
        !header ||
        typeof header !== "object" ||
        Array.isArray(header) ||
        header.STATUS !== "1"
    ) {
        throw new Error("RECONCILE_COMPANY_STATUS_INVALID");
    }

    const errorTags = new Set([
        "LINEERROR",
        "ERROR",
        "ERRORS",
        "EXCEPTION",
        "EXCEPTIONS"
    ]);

    function hasErrorNode(node) {
        if (!node || typeof node !== "object") {
            return false;
        }

        return Object.entries(node).some(([key, value]) =>
            errorTags.has(key.toUpperCase()) ||
            hasErrorNode(value)
        );
    }

    if (hasErrorNode(envelope)) {
        throw new Error("RECONCILE_COMPANY_TALLY_ERROR");
    }

    const body = envelope.BODY;
    const data = body?.DATA;

    if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body) ||
        !data ||
        typeof data !== "object" ||
        Array.isArray(data)
    ) {
        throw new Error("RECONCILE_COMPANY_DATA_INVALID");
    }

    const messages = Array.isArray(data.TALLYMESSAGE)
        ? data.TALLYMESSAGE
        : data.TALLYMESSAGE
            ? [data.TALLYMESSAGE]
            : [];

    const companies = [];

    for (const message of messages) {
        if (
            !message ||
            typeof message !== "object" ||
            Array.isArray(message)
        ) {
            throw new Error("RECONCILE_COMPANY_MESSAGE_INVALID");
        }

        if (!Object.prototype.hasOwnProperty.call(
            message,
            "COMPANY"
        )) {
            continue;
        }

        const entries = Array.isArray(message.COMPANY)
            ? message.COMPANY
            : [message.COMPANY];

        companies.push(...entries);
    }

    if (
        companies.length !== 1 ||
        !companies[0] ||
        typeof companies[0] !== "object" ||
        Array.isArray(companies[0])
    ) {
        throw new Error("RECONCILE_COMPANY_COUNT_INVALID");
    }

    const company = companies[0];

    const guid =
        readReconciliationCompanyField(company, "GUID");

    const companyName =
        readReconciliationCompanyField(company, "NAME");

    const booksBeginningFrom =
        validateReconciliationBooksBeginningFrom(
            readReconciliationCompanyField(
                company,
                "BOOKSFROM"
            )
        );

    if (
        guid.toLowerCase() !==
        expectedCompanyGuid.trim().toLowerCase()
    ) {
        throw new Error("RECONCILE_COMPANY_GUID_MISMATCH");
    }

    if (
        companyName !== expectedCompanyName.trim()
    ) {
        throw new Error("RECONCILE_COMPANY_NAME_MISMATCH");
    }

    if (
        typeof company["@_NAME"] === "string" &&
        company["@_NAME"].trim() !== companyName
    ) {
        throw new Error(
            "RECONCILE_COMPANY_NAME_CONFLICT"
        );
    }

    return {
        guid,
        companyName,
        booksBeginningFrom
    };
}

function buildReconciliationCompanySelectionRequest(company) {
    if (
        typeof company !== "string" ||
        !company.trim() ||
        /[\u0000-\u001F\u007F]/.test(company)
    ) {
        throw new Error(
            "RECONCILE_COMPANY_NAME_INVALID"
        );
    }

    const escapedCompany = company.trim()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

    return `
<ENVELOPE>
    <HEADER>
        <TALLYREQUEST>Export</TALLYREQUEST>
    </HEADER>
    <BODY>
        <DESC>
            <STATICVARIABLES>
                <SVCURRENTCOMPANY>${escapedCompany}</SVCURRENTCOMPANY>
                <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
            </STATICVARIABLES>
            <REPORTNAME>List of Accounts</REPORTNAME>
        </DESC>
    </BODY>
</ENVELOPE>`;
}


function validateReconciliationCompanySelectionResponse(responseXml) {
    if (
        typeof responseXml !== "string" ||
        !responseXml.trim() ||
        /<!\s*(?:DOCTYPE|ENTITY)\b/i.test(responseXml) ||
        XMLValidator.validate(responseXml) !== true
    ) {
        throw new Error("RECONCILE_SELECTION_XML_INVALID");
    }

    const document =
        reconciliationCompanyXmlParser.parse(responseXml);

    const rootKeys = Object.keys(document)
        .filter(key => key !== "?xml");

    const isRecord = value =>
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value);

    if (
        rootKeys.length !== 1 ||
        rootKeys[0] !== "ENVELOPE" ||
        !isRecord(document.ENVELOPE)
    ) {
        throw new Error("RECONCILE_SELECTION_ENVELOPE_INVALID");
    }

    const envelope = document.ENVELOPE;

    const errors = new Set([
        "LINEERROR",
        "ERROR",
        "ERRORS",
        "EXCEPTION",
        "EXCEPTIONS"
    ]);

    function containsError(node) {
        if (!node || typeof node !== "object") {
            return false;
        }

        return Object.entries(node).some(([key, value]) =>
            errors.has(key.toUpperCase()) ||
            containsError(value)
        );
    }

    if (containsError(envelope)) {
        throw new Error("RECONCILE_SELECTION_TALLY_ERROR");
    }

    if (
        !isRecord(envelope.HEADER) ||
        !isRecord(envelope.BODY)
    ) {
        throw new Error("RECONCILE_SELECTION_ENVELOPE_INVALID");
    }

    // Provisional conservative policy.
    // Actual Tally response compatibility is unverified.
    if (envelope.HEADER.STATUS !== "1") {
        throw new Error("RECONCILE_SELECTION_NOT_CONFIRMED");
    }

    return true;
}


function verifyReconciliationCompanyIdentity({
    responseXml,
    expectedCompanyGuid,
    expectedCompanyName
}) {
    const verified = validateReconciliationCompanyResponse({
        responseXml,
        expectedCompanyGuid,
        expectedCompanyName
    });

    return Object.freeze({
        companyGuid: verified.guid,
        companyName: verified.companyName,
        booksBeginningFrom: verified.booksBeginningFrom
    });
}



async function fetchVerifiedReconciliationCompanyWithinOwner({
    companyName,
    expectedCompanyGuid,
    control
}) {
    if (
        typeof expectedCompanyGuid !== "string" ||
        !expectedCompanyGuid.trim()
    ) {
        throw new Error(
            "RECONCILE_COMPANY_GUID_REQUIRED"
        );
    }

    control.assertActive();

    const selectionXml =
        buildReconciliationCompanySelectionRequest(companyName);

    const companyRequestXml =
        buildReconciliationCompanyRequest(companyName);

    const selectionResponseXml =
        await sendToTally(selectionXml);

    control.assertActive();

    validateReconciliationCompanySelectionResponse(
        selectionResponseXml
    );

    control.assertActive();

    const responseXml =
        await sendToTally(companyRequestXml);

    control.assertActive();

    return verifyReconciliationCompanyIdentity({
        responseXml,
        expectedCompanyGuid,
        expectedCompanyName: companyName.trim()
    });
}

async function fetchVerifiedReconciliationCompany({
    companyName,
    expectedCompanyGuid
}) {
    return runReconciliationWithFifo(
        async control =>
            fetchVerifiedReconciliationCompanyWithinOwner({
                companyName,
                expectedCompanyGuid,
                control
            })
    );
}


async function runWithVerifiedReconciliationCompany({
    companyName,
    expectedCompanyGuid,
    operation
}) {
    if (typeof operation !== "function") {
        throw new TypeError(
            "RECONCILE_OPERATION_REQUIRED"
        );
    }

    return runReconciliationWithFifo(async control => {
        control.assertActive();

        const verifiedCompany =
            await fetchVerifiedReconciliationCompanyWithinOwner({
                companyName,
                expectedCompanyGuid,
                control
            });

        control.assertActive();

        const verifiedContext = Object.freeze({
            companyGuid: verifiedCompany.companyGuid,
            companyName: verifiedCompany.companyName,
            booksBeginningFrom:
                verifiedCompany.booksBeginningFrom,

            buildLedgerRequest() {
                control.assertActive();

                return buildFreshReconciliationLedgerRequest({
                    company: verifiedCompany.companyName,
                    booksBeginningFrom:
                        verifiedCompany.booksBeginningFrom
                });
            },

buildVoucherRequest({ voucherGuids, fromDate, toDate }) {
    control.assertActive();

    const booksBeginningFrom =
        verifiedCompany.booksBeginningFrom;

    if (
        typeof fromDate !== "string" ||
        !/^\d{8}$/.test(fromDate) ||
        fromDate < booksBeginningFrom
    ) {
        throw new Error(
            "RECONCILE_VOUCHER_BEFORE_BOOKS_BEGINNING"
        );
    }

    return buildValidatedReconciliationVoucherRequest({
        company: verifiedCompany.companyName,
        voucherGuids,
        fromDate,
        toDate
    });
}

        });

        const result = await operation(
            verifiedContext,
            control
        );


        control.assertActive();

        return result;
    });
}


module.exports = {
    validateLedgerOpeningBalance,
    fetchLedgerOpeningBalance,
    validateReconciliationVoucherRequest,
    buildValidatedReconciliationVoucherRequest,
    parseValidatedReconciliationVouchers,
    runReconciliationWithFifo,
    parseFreshReconciliationLedgerLookups,
    buildFreshReconciliationLedgerRequest,
    buildReconciliationCompanyRequest,
    validateReconciliationBooksBeginningFrom,
    validateReconciliationCompanyResponse,
 
    buildReconciliationCompanySelectionRequest,
    validateReconciliationCompanySelectionResponse,
    verifyReconciliationCompanyIdentity,
    fetchVerifiedReconciliationCompany,
    runWithVerifiedReconciliationCompany,

};

