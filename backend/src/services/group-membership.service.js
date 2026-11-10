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

const INTEGRITY_ERROR_CODE = "GROUP_MEMBERSHIP_DATA_INTEGRITY";
const MEMBER_ROLES = new Set([
    "PRESIDENT",
    "SECRETARY",
    "TREASURER",
    "MEMBER"
]);

function createIntegrityError() {
    const error = new Error("Group membership data integrity error.");
    error.code = INTEGRITY_ERROR_CODE;
    return error;
}

function parseMembershipListGroupId(value) {
    let groupId;

    if (typeof value === "number" && Number.isSafeInteger(value)) {
        groupId = value;
    } else if (typeof value === "string" && /^\d+$/.test(value)) {
        groupId = Number(value);
    }

    if (!isPositiveSafeInteger(groupId)) {
        throw createIntegrityError();
    }

    return groupId;
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

    async function findActiveGroupMemberships(userId) {
        if (!isPositiveSafeInteger(userId)) {
            throw new TypeError("User ID must be a positive safe integer.");
        }

        return authenticatedRead(userId, async (connection) => {
            const result = await connection.execute(
                `SELECT
                    M.GROUP_ID,
                    G.GROUP_CODE,
                    G.GROUP_NAME,
                    M.MEMBER_ROLE,
                    M.MEMBERSHIP_STATUS
                 FROM SHGT_APP.SHG_MEMBERSHIPS M
                 JOIN SHGT_APP.SHG_GROUPS G
                   ON G.GROUP_ID = M.GROUP_ID
                 WHERE M.USER_ID = :userId
                   AND M.MEMBERSHIP_STATUS = :membershipStatus
                   AND G.GROUP_STATUS = :groupStatus
                 ORDER BY G.GROUP_NAME ASC, M.GROUP_ID ASC`,
                {
                    userId,
                    membershipStatus: "ACTIVE",
                    groupStatus: "ACTIVE"
                }
            );

            if (!result || !Array.isArray(result.rows)) {
                throw createIntegrityError();
            }

            const seenGroupIds = new Set();
            const memberships = [];

            for (const row of result.rows) {
                if (!Array.isArray(row) || row.length !== 5) {
                    throw createIntegrityError();
                }

                const [
                    groupIdValue,
                    groupCode,
                    groupName,
                    memberRole,
                    membershipStatus
                ] = row;
                const groupId = parseMembershipListGroupId(groupIdValue);

                if (
                    seenGroupIds.has(groupId) ||
                    typeof groupCode !== "string" ||
                    !groupCode.trim() ||
                    typeof groupName !== "string" ||
                    !groupName.trim() ||
                    !MEMBER_ROLES.has(memberRole) ||
                    membershipStatus !== "ACTIVE"
                ) {
                    throw createIntegrityError();
                }

                seenGroupIds.add(groupId);
                memberships.push({
                    groupId,
                    groupCode,
                    groupName,
                    memberRole,
                    membershipStatus
                });
            }

            return memberships;
        });
    }

    return {
        findActiveGroupMembership,
        findActiveGroupMemberships
    };
}

const groupMembershipService = createGroupMembershipService();

module.exports = {
    ...groupMembershipService,
    createGroupMembershipService,
    INTEGRITY_ERROR_CODE
};
