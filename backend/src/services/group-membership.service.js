const {
    withAuthenticatedRead
} = require("./authenticated-transaction.service");

function isPositiveSafeInteger(value) {
    return typeof value === "number" &&
        Number.isSafeInteger(value) &&
        value > 0;
}

function parseOracleIdentifier(value, columnName) {
    let identifier;

    if (typeof value === "number" && Number.isSafeInteger(value)) {
        identifier = value;
    } else if (typeof value === "string" && /^\d+$/.test(value)) {
        identifier = Number(value);
    }

    if (!isPositiveSafeInteger(identifier)) {
        throw new Error(`Oracle returned an invalid ${columnName}.`);
    }

    return identifier;
}

function createGroupMembershipService({
    withAuthenticatedRead: authenticatedRead = withAuthenticatedRead
} = {}) {
    if (typeof authenticatedRead !== "function") {
        throw new Error("Authenticated read operation is required.");
    }

    async function findActiveGroupMembership(userId, groupId) {
        if (!isPositiveSafeInteger(userId)) {
            throw new TypeError("User ID must be a positive safe integer.");
        }

        if (!isPositiveSafeInteger(groupId)) {
            throw new TypeError("Group ID must be a positive safe integer.");
        }

        return authenticatedRead(userId, async (connection) => {
            const result = await connection.execute(
                `SELECT
                    M.MEMBERSHIP_ID,
                    M.GROUP_ID,
                    M.MEMBER_ROLE,
                    M.MEMBERSHIP_STATUS,
                    G.GROUP_STATUS
                 FROM SHGT_APP.SHG_MEMBERSHIPS M
                 JOIN SHGT_APP.SHG_GROUPS G
                   ON G.GROUP_ID = M.GROUP_ID
                 WHERE M.USER_ID = :userId
                   AND M.GROUP_ID = :groupId`,
                {
                    userId,
                    groupId
                }
            );

            if (!result.rows || result.rows.length === 0) {
                return null;
            }

            if (result.rows.length > 1) {
                throw new Error("Group membership data integrity error.");
            }

            const row = result.rows[0];

            if (!Array.isArray(row) || row.length !== 5) {
                throw new Error("Group membership data integrity error.");
            }

            const [
                membershipIdValue,
                groupIdValue,
                memberRole,
                membershipStatus,
                groupStatus
            ] = row;

            if (
                membershipStatus !== "ACTIVE" ||
                groupStatus !== "ACTIVE"
            ) {
                return null;
            }

            return {
                membershipId: parseOracleIdentifier(
                    membershipIdValue,
                    "membership ID"
                ),
                groupId: parseOracleIdentifier(groupIdValue, "group ID"),
                memberRole,
                membershipStatus,
                groupStatus
            };
        });
    }

    return {
        findActiveGroupMembership
    };
}

const groupMembershipService = createGroupMembershipService();

module.exports = {
    ...groupMembershipService,
    createGroupMembershipService
};
