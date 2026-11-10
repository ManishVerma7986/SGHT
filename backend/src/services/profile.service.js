const {
    withAuthenticatedRead
} = require("./authenticated-transaction.service");

const PROFILE_INTEGRITY_ERROR = "PROFILE_DATA_INTEGRITY";

function createIntegrityError() {
    const error = new Error("Member profile data integrity error.");
    error.code = PROFILE_INTEGRITY_ERROR;
    return error;
}

function isPositiveSafeInteger(value) {
    return typeof value === "number" &&
        Number.isSafeInteger(value) &&
        value > 0;
}

function createProfileService({
    withAuthenticatedRead: authenticatedRead = withAuthenticatedRead
} = {}) {
    if (typeof authenticatedRead !== "function") {
        throw new TypeError("Authenticated read operation is required.");
    }

    async function findOwnProfile(userId) {
        if (!isPositiveSafeInteger(userId)) {
            throw new TypeError("User ID must be a positive safe integer.");
        }

        return authenticatedRead(userId, async (connection) => {
            const result = await connection.execute(
                `SELECT COUNT(*), MAX(FULL_NAME)
                 FROM SHGT_APP.MEMBER_PROFILES
                 WHERE USER_ID = :userId`,
                { userId }
            );

            if (
                !result ||
                !Array.isArray(result.rows) ||
                result.rows.length !== 1 ||
                !Array.isArray(result.rows[0]) ||
                result.rows[0].length !== 2
            ) {
                throw createIntegrityError();
            }

            const [countValue, fullName] = result.rows[0];
            const count = typeof countValue === "number"
                ? countValue
                : typeof countValue === "string" && /^\d+$/.test(countValue)
                    ? Number(countValue)
                    : NaN;

            if (!Number.isSafeInteger(count) || count < 0 || count > 1) {
                throw createIntegrityError();
            }
            if (count === 0) {
                if (fullName !== null) {
                    throw createIntegrityError();
                }
                return null;
            }
            if (
                typeof fullName !== "string" ||
                !fullName.trim() ||
                fullName !== fullName.trim()
            ) {
                throw createIntegrityError();
            }

            return Object.freeze({ fullName });
        });
    }

    return Object.freeze({ findOwnProfile });
}

module.exports = {
    PROFILE_INTEGRITY_ERROR,
    createProfileService
};
