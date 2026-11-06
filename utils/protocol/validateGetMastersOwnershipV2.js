"use strict";

const { createHash } = require("node:crypto");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HASH = /^sha256:[0-9a-f]{64}$/;
const INPUT_FIELDS = ["lastAlterId", "lastStockAlterId", "lastLedgerAlterId"];
const REQUIRED = [
    "protocolVersion", "operation", "resourceId", "requestId", "identityScope",
    "companyIdentity", "payloadFingerprint", "tallyInputFingerprint",
    "ownerGeneration", "ownerToken", "connectorEpoch", "sessionIdentity",
    "company", "authorizationGrant"
];
const ALLOWED = new Set([...REQUIRED, ...INPUT_FIELDS]);

function fail(code) {
    return Object.freeze({ ok: false, code });
}

function text(value) {
    return typeof value === "string" && value.length > 0 && value.trim() === value;
}

// Snapshot flat data properties without invoking accessors or retaining caller objects.
function snapshot(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const result = Object.create(null);
    for (const key of Reflect.ownKeys(value)) {
        if (typeof key !== "string") return null;
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !Object.hasOwn(descriptor, "value")) return null;
        result[key] = descriptor.value;
    }
    return result;
}

/**
 * Standalone proposed v2 schema; NOT imported by runtime handlers.
 * sessionIdentity is the trusted transport connection ID, not an envelope assertion.
 * ownerGeneration must be a positive safe integer (no coercion).
 * payloadFingerprint is opaque: its authoritative meaning is checked by the verifier.
 * tallyInputFingerprint uses the existing getMasters-input-v1 serialization.
 *
 * verifyAuthorizationGrant receives the frozen, complete claims snapshot and must
 * return literal true only after verifying its authenticity, complete claim binding,
 * current ownership generation, expiry/revocation and intended resource/session.
 * A token, generation or caller boolean alone is never authorization evidence.
 * Missing verifier, non-true result and exceptions all fail closed. The verifier
 * must settle; transport timeouts/cancellation are outside this pure validator.
 * No queue, registry, network, clock or persistent state is accessed here.
 */
async function validateGetMastersOwnershipV2(envelope, options) {
    let data;
    let expected;
    let verifier;
    try {
        data = snapshot(envelope);
        const settings = snapshot(options);
        expected = snapshot(settings?.expected);
        verifier = settings?.verifyAuthorizationGrant;
    } catch {
        return fail("INVALID_VALIDATION_INPUT");
    }

    if (!data) return fail("INVALID_ENVELOPE");
    if (data.protocolVersion !== 2) return fail("UNSUPPORTED_PROTOCOL_VERSION");
    if (Object.keys(data).some(key => !ALLOWED.has(key))) {
        return fail("UNEXPECTED_ENVELOPE_FIELD");
    }
    if (REQUIRED.some(key => !Object.hasOwn(data, key))) {
        return fail("MISSING_ENVELOPE_FIELD");
    }
    if (data.operation !== "getMasters") return fail("INVALID_OPERATION");
    for (const key of [
        "resourceId", "identityScope", "ownerToken", "sessionIdentity",
        "company", "authorizationGrant"
    ]) {
        if (!text(data[key])) return fail("INVALID_IDENTITY_FIELD");
    }
    if (typeof data.requestId !== "string" || !UUID.test(data.requestId) ||
        typeof data.connectorEpoch !== "string" || !UUID.test(data.connectorEpoch)) {
        return fail("INVALID_EXECUTION_IDENTITY");
    }
    if (!text(data.companyIdentity) || !data.companyIdentity.startsWith("guid:") ||
        data.companyIdentity.slice(5).trim().length === 0) {
        return fail("INVALID_COMPANY_IDENTITY");
    }
    if (typeof data.payloadFingerprint !== "string" || !HASH.test(data.payloadFingerprint) ||
        typeof data.tallyInputFingerprint !== "string" || !HASH.test(data.tallyInputFingerprint)) {
        return fail("INVALID_FINGERPRINT");
    }
    if (!Number.isSafeInteger(data.ownerGeneration) || data.ownerGeneration <= 0) {
        return fail("INVALID_OWNER_GENERATION");
    }

    const claims = {};
    for (const key of REQUIRED) claims[key] = data[key];
    for (const key of INPUT_FIELDS) {
        const value = data[key];
        if (value !== undefined && value !== null && typeof value !== "string" &&
            !(typeof value === "number" && Number.isFinite(value))) {
            return fail("INVALID_TALLY_INPUT");
        }
        claims[key] = value ?? null;
    }
    const fingerprint = "sha256:" + createHash("sha256").update(JSON.stringify([
        "getMasters-input-v1", claims.company,
        ...INPUT_FIELDS.map(key => claims[key])
    ]), "utf8").digest("hex");
    if (fingerprint !== claims.tallyInputFingerprint) {
        return fail("TALLY_INPUT_FINGERPRINT_MISMATCH");
    }

    if (!expected || !text(expected.resourceId) || !text(expected.sessionIdentity) ||
        typeof expected.connectorEpoch !== "string" || !UUID.test(expected.connectorEpoch)) {
        return fail("TRUSTED_CONTEXT_REQUIRED");
    }
    for (const key of ["resourceId", "connectorEpoch", "sessionIdentity"]) {
        if (claims[key] !== expected[key]) return fail("TRUSTED_CONTEXT_MISMATCH");
    }
    if (typeof verifier !== "function") return fail("GRANT_VERIFIER_UNAVAILABLE");

    Object.freeze(claims);
    try {
        if (await verifier(claims) !== true) return fail("AUTHORIZATION_REJECTED");
    } catch {
        return fail("GRANT_VERIFIER_FAILED");
    }
    return Object.freeze({ ok: true, claims });
}

module.exports = { validateGetMastersOwnershipV2 };
