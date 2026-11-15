
"use strict";

// Manual Reconciliation ONLY.
// Experimental request until verified against actual Tally output.

function buildReconciliationVoucherOccurrenceRequest({
    company,
    voucherGuids,
    fromDate,
    toDate
}) {
    if (
        typeof company !== "string" ||
        !company.trim() ||
        /[<>&"'\u0000-\u001F\u007F]/.test(company)
    ) {
        throw new Error("RECONCILE_OCCURRENCE_COMPANY_INVALID");
    }

    if (!Array.isArray(voucherGuids) || voucherGuids.length === 0) {
        throw new Error("RECONCILE_OCCURRENCE_GUIDS_INVALID");
    }

    const seen = new Set();

    for (const guid of voucherGuids) {
        if (
            typeof guid !== "string" ||
            !/^[A-Za-z0-9][A-Za-z0-9-]{0,127}$/.test(guid)
        ) {
            throw new Error("RECONCILE_OCCURRENCE_GUID_INVALID");
        }

        const folded = guid.toLowerCase();

        if (seen.has(folded)) {
            throw new Error("RECONCILE_OCCURRENCE_GUID_DUPLICATE");
        }

        seen.add(folded);
    }

    function validDate(value) {
        if (
            typeof value !== "string" ||
            !/^\d{8}$/.test(value)
        ) {
            return false;
        }

        const year = Number(value.slice(0, 4));
        const month = Number(value.slice(4, 6));
        const day = Number(value.slice(6, 8));

        if (year < 1 || month < 1 || month > 12 || day < 1) {
            return false;
        }

        const leap =
            year % 4 === 0 &&
            (year % 100 !== 0 || year % 400 === 0);

        const days = [
            31, leap ? 29 : 28, 31, 30, 31,
            30, 31, 31, 30, 31, 30, 31
        ];

        return day <= days[month - 1];
    }

    if (
        !validDate(fromDate) ||
        !validDate(toDate) ||
        fromDate > toDate
    ) {
        throw new Error("RECONCILE_OCCURRENCE_DATES_INVALID");
    }

    const filter = voucherGuids
        .map(guid => `$$IsEqual:$GUID:"${guid}"`)
        .join(" OR ");

    // Candidate TDL expression.
    // Do NOT use for settlement until real Tally response
    // and count semantics have been independently verified.

    return `<ENVELOPE>
<HEADER>
<VERSION>1</VERSION>
<TALLYREQUEST>Export</TALLYREQUEST>
<TYPE>Collection</TYPE>
<ID>BilleyReconcileOccurrenceCollection</ID>
</HEADER>
<BODY>
<DESC>
<STATICVARIABLES>
<SVCURRENTCOMPANY>${company.trim()}</SVCURRENTCOMPANY>
<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
<SVFROMDATE TYPE="Date">${fromDate}</SVFROMDATE>
<SVTODATE TYPE="Date">${toDate}</SVTODATE>
</STATICVARIABLES>
<TDL>
<TDLMESSAGE>
<COLLECTION NAME="BilleyReconcileOccurrenceCollection">
<TYPE>Voucher</TYPE>
<FILTER>BilleyReconcileOccurrenceGuidFilter</FILTER>
<FETCH>GUID,MASTERID,ALTERID,DATE</FETCH>
<COMPUTE>BILLEYLEDGEROCCURRENCECOUNT:$$NumItems:AllLedgerEntries</COMPUTE>
</COLLECTION>
<SYSTEM TYPE="Formulae" NAME="BilleyReconcileOccurrenceGuidFilter">${filter}</SYSTEM>
</TDLMESSAGE>
</TDL>
</DESC>
</BODY>
</ENVELOPE>`;
}

module.exports = {
    buildReconciliationVoucherOccurrenceRequest
};
