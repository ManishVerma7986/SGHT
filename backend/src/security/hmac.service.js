
const crypto = require("crypto");

function getHmacKey() {
    const keyHex = process.env.SHGT_BACKEND_HMAC_KEY;

    if (!/^[0-9a-fA-F]{64}$/.test(keyHex || "")) {
        throw new Error("Backend HMAC key is missing or invalid.");
    }

    return Buffer.from(keyHex, "hex");
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

function createHmacAssertion(userId) {
    const normalizedUserId = normalizeUserId(userId);
    const key = getHmacKey();

    const issuedAtEpoch = Math.floor(Date.now() / 1000);
    const nonce = crypto.randomBytes(32).toString("hex").toUpperCase();

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
    createHmacAssertion
};
