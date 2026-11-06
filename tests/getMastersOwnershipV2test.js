"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createHash, createHmac } = require("node:crypto");
const { validateGetMastersOwnershipV2: validate } =
    require("../utils/protocol/validateGetMastersOwnershipV2");

const epoch = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
const expected = Object.freeze({
    resourceId: "fixture-resource", connectorEpoch: epoch, sessionIdentity: "socket-A"
});

function inputHash(data) {
    return "sha256:" + createHash("sha256").update(JSON.stringify([
        "getMasters-input-v1", data.company, data.lastAlterId ?? null,
        data.lastStockAlterId ?? null, data.lastLedgerAlterId ?? null
    ])).digest("hex");
}

// Test-only deterministic grant. This is not a production grant format or issuer.
function sign(data) {
    const canonical = { ...data };
    delete canonical.authorizationGrant;
    for (const key of ["lastAlterId", "lastStockAlterId", "lastLedgerAlterId"]) {
        canonical[key] ??= null;
    }
    return createHmac("sha256", "isolated-test-key")
        .update(JSON.stringify(Object.keys(canonical).sort().map(key => [key, canonical[key]])))
        .digest("hex");
}

function fixture(overrides = {}) {
    const data = {
        protocolVersion: 2, operation: "getMasters", resourceId: expected.resourceId,
        requestId, identityScope: "fixture-scope", companyIdentity: "guid:fixture-company",
        payloadFingerprint: "sha256:" + "b".repeat(64), ownerGeneration: 7,
        ownerToken: "opaque-owner-token", connectorEpoch: epoch,
        sessionIdentity: expected.sessionIdentity, company: "Fixture Company",
        lastAlterId: "0", lastStockAlterId: "0", lastLedgerAlterId: "0",
        ...overrides
    };
    data.tallyInputFingerprint = inputHash(data);
    data.authorizationGrant = sign(data);
    return data;
}

function options(verifier = claims => claims.ownerGeneration === 7 &&
    claims.authorizationGrant === sign(claims)) {
    return { expected, verifyAuthorizationGrant: verifier };
}

async function rejects(data, code, settings = options()) {
    const result = await validate(data, settings);
    assert.equal(result.ok, false);
    if (code) assert.equal(result.code, code);
    assert.equal(Object.hasOwn(result, "claims"), false);
}

test("valid signed envelope returns immutable claims without mutation", async () => {
    const data = fixture();
    const before = JSON.stringify(data);
    const result = await validate(data, options());
    assert.equal(result.ok, true);
    assert.equal(result.claims.requestId, requestId);
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result.claims), true);
    assert.equal(JSON.stringify(data), before);
});

test("async trusted verifier is awaited", async () => {
    const result = await validate(fixture(), options(async claims =>
        claims.authorizationGrant === sign(claims)));
    assert.equal(result.ok, true);
});

test("every required envelope field fails closed when missing", async () => {
    for (const key of Object.keys(fixture()).filter(key => !key.startsWith("last"))) {
        const data = fixture();
        delete data[key];
        await rejects(data);
    }
});

test("null, arrays, primitives and accessor envelopes are rejected", async () => {
    for (const data of [null, [], "envelope", 1, true]) await rejects(data, "INVALID_ENVELOPE");
    const data = fixture();
    let invoked = false;
    Object.defineProperty(data, "ownerToken", { get() { invoked = true; return "token"; } });
    await rejects(data, "INVALID_ENVELOPE");
    assert.equal(invoked, false);
});

test("unsupported protocol versions and operations are rejected", async () => {
    for (const version of [1, 3, "2", null]) {
        await rejects(fixture({ protocolVersion: version }), "UNSUPPORTED_PROTOCOL_VERSION");
    }
    await rejects(fixture({ operation: "other" }), "INVALID_OPERATION");
});

test("identity types, UUIDs and company identity are validated", async () => {
    for (const key of ["resourceId", "identityScope", "ownerToken", "sessionIdentity", "company"]) {
        for (const value of ["", " ", " padded ", 1, true, {}]) {
            await rejects(fixture({ [key]: value }));
        }
    }
    for (const key of ["requestId", "connectorEpoch"]) {
        for (const value of ["bad-id", "", 123]) await rejects(fixture({ [key]: value }));
    }
    for (const value of ["guid:", "guid: ", "company", 1]) {
        await rejects(fixture({ companyIdentity: value }), "INVALID_COMPANY_IDENTITY");
    }
});

test("owner generation requires a positive safe integer", async () => {
    for (const value of [0, -1, 1.5, "7", true, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
        await rejects(fixture({ ownerGeneration: value }), "INVALID_OWNER_GENERATION");
    }
});

test("malformed hashes and invalid Tally inputs are rejected before verifier", async () => {
    let calls = 0;
    const settings = options(() => { calls++; return true; });
    for (const key of ["payloadFingerprint", "tallyInputFingerprint"]) {
        const data = fixture();
        data[key] = "sha256:invalid";
        await rejects(data, "INVALID_FINGERPRINT", settings);
    }
    for (const key of ["lastAlterId", "lastStockAlterId", "lastLedgerAlterId"]) {
        for (const value of [{}, [], true, Infinity, NaN]) {
            const data = fixture();
            data[key] = value;
            await rejects(data, "INVALID_TALLY_INPUT", settings);
        }
    }
    assert.equal(calls, 0);
});

test("altered actual extraction input fails recomputed fingerprint", async () => {
    const data = fixture();
    data.company = "Different Company";
    await rejects(data, "TALLY_INPUT_FINGERPRINT_MISMATCH");
});

test("altered signed identities and fingerprints cannot authorize", async () => {
    const changes = {
        requestId: "33333333-3333-4333-8333-333333333333",
        identityScope: "other-scope", companyIdentity: "guid:other-company",
        payloadFingerprint: "sha256:" + "c".repeat(64), ownerToken: "other-token",
        ownerGeneration: 8, authorizationGrant: "forged-grant"
    };
    for (const [key, value] of Object.entries(changes)) {
        const data = fixture();
        data[key] = value;
        await rejects(data, "AUTHORIZATION_REJECTED");
    }
    const data = fixture();
    data.lastAlterId = "1";
    data.tallyInputFingerprint = inputHash(data);
    await rejects(data, "AUTHORIZATION_REJECTED");
});

test("trusted resource, epoch and session must match even with a valid grant", async () => {
    for (const change of [
        { resourceId: "other-resource" },
        { connectorEpoch: "33333333-3333-4333-8333-333333333333" },
        { sessionIdentity: "socket-B" }
    ]) {
        await rejects(fixture(change), "TRUSTED_CONTEXT_MISMATCH", options(() => true));
    }
});

test("trusted context and verifier are mandatory", async () => {
    await rejects(fixture(), "TRUSTED_CONTEXT_REQUIRED", {});
    await rejects(fixture(), "TRUSTED_CONTEXT_REQUIRED", { expected: {} });
    await rejects(fixture(), "GRANT_VERIFIER_UNAVAILABLE", { expected });
    await rejects(fixture(), "GRANT_VERIFIER_UNAVAILABLE", {
        expected, verifyAuthorizationGrant: true
    });
});

test("verifier rejection, non-boolean results and exceptions fail closed", async () => {
    for (const result of [false, undefined, null, 1, "true", { trusted: true }]) {
        await rejects(fixture(), "AUTHORIZATION_REJECTED", options(() => result));
    }
    await rejects(fixture(), "GRANT_VERIFIER_FAILED", options(() => { throw new Error("secret"); }));
    await rejects(fixture(), "GRANT_VERIFIER_FAILED", options(async () => { throw new Error("secret"); }));
});

test("caller trusted boolean and extra fields are never authorization", async () => {
    await rejects({ ...fixture(), trusted: true }, "UNEXPECTED_ENVELOPE_FIELD");
    await rejects({ ...fixture(), unexpected: "value" }, "UNEXPECTED_ENVELOPE_FIELD");
    await rejects(fixture(), "GRANT_VERIFIER_UNAVAILABLE", { expected, trusted: true });
});

test("verifier sees a frozen snapshot unaffected by caller mutation", async () => {
    const data = fixture();
    let seen;
    const pending = validate(data, options(async claims => {
        seen = claims;
        await Promise.resolve();
        return claims.authorizationGrant === sign(claims);
    }));
    data.ownerToken = "mutated-after-validation-start";
    const result = await pending;
    assert.equal(result.ok, true);
    assert.equal(seen.ownerToken, "opaque-owner-token");
    assert.equal(Object.isFrozen(seen), true);
});

test("optional input omission canonicalizes to null and preserves grant binding", async () => {
    const data = fixture({ lastAlterId: undefined, lastStockAlterId: null, lastLedgerAlterId: 0 });
    delete data.lastAlterId;
    const result = await validate(data, options());
    assert.equal(result.ok, true);
    assert.equal(result.claims.lastAlterId, null);
    assert.equal(result.claims.lastStockAlterId, null);
    assert.equal(result.claims.lastLedgerAlterId, 0);
});
