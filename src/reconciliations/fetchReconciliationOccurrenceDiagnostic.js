
"use strict";

// Manual Reconciliation ONLY.
// Diagnostic capability; does not prove completeness.
// Must be called under the existing verified FIFO owner.

const {
    buildReconciliationVoucherOccurrenceRequest
} = require("./reconciliationVoucherOccurrenceRequest");

async function fetchReconciliationOccurrenceDiagnostic({
    control,
    verifiedCompany,
    request,
    sendToTally
}) {
   
if (
    !control ||
    typeof control.assertActive !== "function" ||
    typeof sendToTally !== "function" ||
    !verifiedCompany ||
    typeof verifiedCompany.companyName !== "string" ||
    !verifiedCompany.companyName.trim() ||
    !request ||
    request.company !== verifiedCompany.companyName ||
    typeof verifiedCompany.companyGuid !== "string" ||
    !verifiedCompany.companyGuid.trim() ||
    typeof verifiedCompany.booksBeginningFrom !== "string" ||
    !/^\d{8}$/.test(verifiedCompany.booksBeginningFrom) ||
    typeof request.fromDate !== "string" ||
    !/^\d{8}$/.test(request.fromDate) ||
    request.fromDate < verifiedCompany.booksBeginningFrom
) {
    throw new Error(
        "RECONCILE_OCCURRENCE_CONTEXT_INVALID"
    );
}


    control.assertActive();

    const xml = buildReconciliationVoucherOccurrenceRequest({
        company: verifiedCompany.companyName,
        voucherGuids: request.voucherGuids,
        fromDate: request.fromDate,
        toDate: request.toDate
    });

    control.assertActive();

    const responseXml = await sendToTally(xml);

    control.assertActive();

    if (
        typeof responseXml !== "string" ||
        !responseXml.trim()
    ) {
        throw new Error(
            "RECONCILE_OCCURRENCE_RESPONSE_EMPTY"
        );
    }

    return Object.freeze({
        status: "UNVERIFIED_RAW_RESPONSE",
        requestXml: xml,
        responseXml
    });
}

module.exports = {
    fetchReconciliationOccurrenceDiagnostic
};
