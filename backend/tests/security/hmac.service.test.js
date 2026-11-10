const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const {
    createHmacAssertion
} = require("../../src/security/hmac.service");

const ORIGINAL_HMAC_KEY = process.env.SHGT_BACKEND_HMAC_KEY;
const ORIGINAL_PROFILE = process.env.SHGT_DEPLOYMENT_PROFILE;

test.after(() => {
    if (ORIGINAL_HMAC_KEY === undefined) {
        delete process.env.SHGT_BACKEND_HMAC_KEY;
    } else {
        process.env.SHGT_BACKEND_HMAC_KEY = ORIGINAL_HMAC_KEY;
    }

    if (ORIGINAL_PROFILE === undefined) {
        delete process.env.SHGT_DEPLOYMENT_PROFILE;
    } else {
        process.env.SHGT_DEPLOYMENT_PROFILE = ORIGINAL_PROFILE;
    }
});

function expectedSignature(keyHex, assertion) {
    const payload =
        `${assertion.userId}|${assertion.issuedAtEpoch}|${assertion.nonce}`;

    return crypto
        .createHmac("sha256", Buffer.from(keyHex, "hex"))
        .update(payload, "utf8")
        .digest("hex")
        .toUpperCase();
}

test("decodes a synthetic 32-byte hexadecimal key for HMAC-SHA256", () => {
    const keyHex = "0123456789abcdef".repeat(4);
    process.env.SHGT_BACKEND_HMAC_KEY = keyHex;
    const now = Date.now();

    const assertion = createHmacAssertion(123);

    assert.equal(Buffer.from(keyHex, "hex").length, 32);
    assert.ok(
        Math.abs(assertion.issuedAtEpoch - Math.floor(now / 1000)) <= 1
    );
    assert.equal(assertion.userId, 123);
    assert.match(assertion.nonce, /^[0-9A-F]{64}$/);
    assert.match(assertion.signature, /^[0-9A-F]{64}$/);
    assert.equal(assertion.signature, expectedSignature(keyHex, assertion));
});

test("production and development processes can use independent synthetic keys", () => {
    const productionKey = "1a".repeat(32);
    const developmentKey = "b2".repeat(32);

    process.env.SHGT_DEPLOYMENT_PROFILE = "production";
    process.env.SHGT_BACKEND_HMAC_KEY = productionKey;
    const productionAssertion = createHmacAssertion(123);

    process.env.SHGT_DEPLOYMENT_PROFILE = "development";
    process.env.SHGT_BACKEND_HMAC_KEY = developmentKey;
    const developmentAssertion = createHmacAssertion(123);

    assert.equal(
        productionAssertion.signature,
        expectedSignature(productionKey, productionAssertion)
    );
    assert.equal(
        developmentAssertion.signature,
        expectedSignature(developmentKey, developmentAssertion)
    );
    assert.notEqual(
        developmentAssertion.signature,
        expectedSignature(productionKey, developmentAssertion)
    );
});

test("assertions accept explicit timestamp and unique nonce for negative package tests", () => {
    const keyHex = "c3".repeat(32);
    const nonce = "D4".repeat(32);
    const issuedAtEpoch = Math.floor(Date.now() / 1000) - 86_400;
    process.env.SHGT_BACKEND_HMAC_KEY = keyHex;

    const assertion = createHmacAssertion(123, {
        issuedAtEpoch,
        nonce
    });

    assert.equal(assertion.issuedAtEpoch, issuedAtEpoch);
    assert.equal(assertion.nonce, nonce);
    assert.equal(
        assertion.signature,
        expectedSignature(keyHex, assertion)
    );
});

test("rejects missing and malformed HMAC keys without exposing key material", () => {
    for (const key of [
        undefined,
        "",
        "not-a-key",
        "ab".repeat(31),
        "z".repeat(64)
    ]) {
        if (key === undefined) {
            delete process.env.SHGT_BACKEND_HMAC_KEY;
        } else {
            process.env.SHGT_BACKEND_HMAC_KEY = key;
        }

        assert.throws(
            () => createHmacAssertion(123),
            (error) => {
                assert.equal(
                    error.message,
                    "Backend HMAC key is missing or invalid."
                );
                if (key) {
                    assert.equal(error.message.includes(key), false);
                }
                return true;
            }
        );
    }
});
