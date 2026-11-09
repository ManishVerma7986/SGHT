const {
    getConnection
} = require("../config/database");

async function findShgtUserByPrivyId(privyUserId) {
    if (
        typeof privyUserId !== "string" ||
        !privyUserId.trim()
    ) {
        throw new Error("Valid Privy user ID is required.");
    }

    let connection;

    try {
        connection = await getConnection();

        const result = await connection.execute(
            `SELECT
                USER_ID,
                ACCOUNT_STATUS
             FROM SHGT_APP.USERS
             WHERE PRIVY_USER_ID = :privyUserId`,
            {
                privyUserId: privyUserId.trim()
            }
        );

        if (result.rows.length === 0) {
            return null;
        }

        const userId = Number(result.rows[0][0]);
        const accountStatus = result.rows[0][1];

        if (!Number.isSafeInteger(userId) || userId <= 0) {
            throw new Error("Invalid SHGT user ID returned by database.");
        }

        return {
            userId,
            accountStatus
        };
    } finally {
        if (connection) {
            await connection.close();
        }
    }
}

module.exports = {
    findShgtUserByPrivyId
};