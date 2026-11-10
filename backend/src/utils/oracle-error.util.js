function isUniqueConstraintViolation(error) {
    return error?.errorNum === 1;
}

function isPhoneNumberDuplicate(error) {
    if (!isUniqueConstraintViolation(error)) {
        return false;
    }

    return error.message?.includes("UQ_MEMBER_PHONE") === true;
}

module.exports = {
    isUniqueConstraintViolation,
    isPhoneNumberDuplicate
};