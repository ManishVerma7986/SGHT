
const crypto = require("crypto");

function decodeHmacKey(keyHex) {
    if (!/^[0-9a-fA-F]{64}$/.test(keyHex || "")) {
        throw new Error("Backend HMAC key is missing or invalid.");
    }

    const key = Buffer.from(keyHex, "hex");

    if (key.length !== 32) {
        throw new Error("Backend HMAC key is missing or invalid.");
    }

    return key;
}

function getHmacKey() {
    return decodeHmacKey(process.env.SHGT_BACKEND_HMAC_KEY);
}

function validateHmacKey(keyHex = process.env.SHGT_BACKEND_HMAC_KEY) {
    decodeHmacKey(keyHex);
}

function normalizeUserId(userId) {
    if (
        typeof userId !== "number" ||
        !Number.isSafeInteger(userId) ||
        userId <= 0
    ) {
        throw new Error("Invalid authenticated user ID.");
    }

    return String(userId);
}

function createHmacAssertion(userId, options = {}) {
    const normalizedUserId = normalizeUserId(userId);
    const key = getHmacKey();

    const issuedAtEpoch = options.issuedAtEpoch ??
        Math.floor(Date.now() / 1000);
    const nonce = options.nonce ??
        crypto.randomBytes(32).toString("hex").toUpperCase();

    if (!Number.isSafeInteger(issuedAtEpoch) || issuedAtEpoch <= 0) {
        throw new Error("Invalid HMAC assertion timestamp.");
    }

    if (!/^[0-9A-F]{64}$/.test(nonce)) {
        throw new Error("Invalid HMAC assertion nonce.");
    }

    // Must match the canonical payload in SHGT_SECURITY_PKG.
    const payload = `${normalizedUserId}|${issuedAtEpoch}|${nonce}`;

    const signature = crypto
        .createHmac("sha256", key)
        .update(payload, "utf8")
        .digest("hex")
        .toUpperCase();

    return {
        userId: Number(normalizedUserId),
        issuedAtEpoch,
        nonce,
        signature
    };
}

module.exports = {
    createHmacAssertion,
    validateHmacKey
};
