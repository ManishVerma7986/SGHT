const test = require("node:test");
const assert = require("node:assert/strict");

const {
    isUniqueConstraintViolation,
    isPhoneNumberDuplicate
} = require("../../src/utils/oracle-error.util");

test("Identifies Oracle unique constraint violations", () => {
    const error = {
        errorNum: 1,
        message: "ORA-00001: unique constraint violated"
    };

    assert.equal(isUniqueConstraintViolation(error), true);
});

test("Identifies duplicate phone-number violations", () => {
    const error = {
        errorNum: 1,
        message: "ORA-00001: unique constraint (SHGT_APP.UQ_MEMBER_PHONE) violated"
    };

    assert.equal(isPhoneNumberDuplicate(error), true);
});

test("Does not identify Privy uniqueness violations as phone duplicates", () => {
    const error = {
        errorNum: 1,
        message: "ORA-00001: unique constraint (SHGT_APP.UQ_USERS_PRIVY) violated"
    };

    assert.equal(isPhoneNumberDuplicate(error), false);
});

test("Ignores non-unique database errors", () => {
    const error = {
        errorNum: 904,
        message: "ORA-00904: invalid identifier"
    };

    assert.equal(isUniqueConstraintViolation(error), false);
    assert.equal(isPhoneNumberDuplicate(error), false);
});