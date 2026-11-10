
const test = require("node:test");
const assert = require("node:assert/strict");

const {
    normalizePhoneNumber
} = require("../../src/utils/phone-number.util");

test("Accepts canonical international phone numbers", () => {
    assert.equal(
        normalizePhoneNumber("+919876543210"),
        "+919876543210"
    );
});

test("Normalizes spaces, hyphens and parentheses", () => {
    assert.equal(
        normalizePhoneNumber("+91 (98765) 43210"),
        "+919876543210"
    );

    assert.equal(
        normalizePhoneNumber("+91-98765-43210"),
        "+919876543210"
    );
});

test("Rejects numbers without an international prefix", () => {
    assert.throws(
        () => normalizePhoneNumber("919876543210"),
        /Invalid international phone number/
    );

    assert.throws(
        () => normalizePhoneNumber("9876543210"),
        /Invalid international phone number/
    );
});

test("Rejects invalid international numbers", () => {
    assert.throws(() => normalizePhoneNumber("+0123456789"));
    assert.throws(() => normalizePhoneNumber("+1234567"));
    assert.throws(() => normalizePhoneNumber("+1234567890123456"));
});

test("Returns null for missing or empty optional values", () => {
    assert.equal(normalizePhoneNumber(null), null);
    assert.equal(normalizePhoneNumber(undefined), null);
    assert.equal(normalizePhoneNumber("   "), null);
});

test("Rejects non-string values", () => {
    assert.throws(
        () => normalizePhoneNumber(919876543210),
        /Phone number must be a string/
    );
});
