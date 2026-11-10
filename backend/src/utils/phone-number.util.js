
function normalizePhoneNumber(value) {
    if (value === undefined || value === null) {
        return null;
    }

    if (typeof value !== "string") {
        throw new TypeError("Phone number must be a string.");
    }

    const trimmed = value.trim();

    if (!trimmed) {
        return null;
    }

    const normalized = trimmed.replace(/[\s()-]/g, "");

    // Require international format with a leading +.
    // E.164 permits a maximum of 15 digits.
    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
        throw new Error("Invalid international phone number.");
    }

    return normalized;
}

module.exports = {
    normalizePhoneNumber
};
