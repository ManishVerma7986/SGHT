const {
    withAuthenticatedRead
} = require("./authenticated-transaction.service");

const INTEGRITY_ERROR_CODE = "GROUP_MEMBER_PROFILE_DATA_INTEGRITY";

function isPositiveSafeInteger(value) {
    return typeof value === "number" &&
        Number.isSafeInteger(value) &&
        value > 0;
}

function createIntegrityError() {
    const error = new Error("Group member profile data integrity error.");
    error.code = INTEGRITY_ERROR_CODE;
    return error;
}

function parseOracleCount(value) {
    let count;

    if (typeof value === "number" && Number.isSafeInteger(value)) {
        count = value;
    } else if (typeof value === "string" && /^\d+$/.test(value)) {
        count = Number(value);
    }

    if (!Number.isSafeInteger(count) || count < 0) {
        throw createIntegrityError();
    }

    return count;
}

function createGroupMemberProfileService({
    withAuthenticatedRead: authenticatedRead = withAuthenticatedRead
} = {}) {
    if (typeof authenticatedRead !== "function") {
        throw new Error("Authenticated read operation is required.");
    }

    async function findOwnGroupProfile(userId, groupId) {
        if (!isPositiveSafeInteger(userId)) {
            throw new TypeError("User ID must be a positive safe integer.");
        }
        if (!isPositiveSafeInteger(groupId)) {
            throw new TypeError("Group ID must be a positive safe integer.");
        }

        return authenticatedRead(userId, async (connection) => {
            const result = await connection.execute(
                `WITH active_membership AS (
                    SELECT COUNT(*) AS MEMBERSHIP_COUNT
                    FROM SHGT_APP.SHG_MEMBERSHIPS M
                    WHERE M.USER_ID = :userId
                      AND M.GROUP_ID = :groupId
                      AND M.MEMBERSHIP_STATUS = :activeMembershipStatus
                ),
                active_group AS (
                    SELECT COUNT(*) AS GROUP_COUNT
                    FROM SHGT_APP.SHG_GROUPS G
                    WHERE G.GROUP_ID = :groupId
                      AND G.GROUP_STATUS = :activeGroupStatus
                ),
                member_profile AS (
                    SELECT
                        COUNT(*) AS PROFILE_COUNT,
                        MAX(P.FULL_NAME) AS FULL_NAME
                    FROM SHGT_APP.MEMBER_PROFILES P
                    WHERE P.USER_ID = :userId
                )
                SELECT
                    M.MEMBERSHIP_COUNT,
                    G.GROUP_COUNT,
                    P.PROFILE_COUNT,
                    P.FULL_NAME
                FROM active_membership M
                CROSS JOIN active_group G
                CROSS JOIN member_profile P`,
                {
                    userId,
                    groupId,
                    activeMembershipStatus: "ACTIVE",
                    activeGroupStatus: "ACTIVE"
                }
            );

            if (
                !result ||
                !Array.isArray(result.rows) ||
                result.rows.length !== 1 ||
                !Array.isArray(result.rows[0]) ||
                result.rows[0].length !== 4
            ) {
                throw createIntegrityError();
            }

            const [
                membershipCountValue,
                activeGroupCountValue,
                profileCountValue,
                fullName
            ] = result.rows[0];
            const membershipCount = parseOracleCount(membershipCountValue);
            const activeGroupCount = parseOracleCount(activeGroupCountValue);
            const profileCount = parseOracleCount(profileCountValue);

            if (activeGroupCount > 1 || membershipCount > 1) {
                throw createIntegrityError();
            }

            if (activeGroupCount === 0 || membershipCount === 0) {
                return {
                    authorized: false,
                    profile: null
                };
            }

            if (profileCount > 1) {
                throw createIntegrityError();
            }

            if (profileCount === 0) {
                if (fullName !== null) {
                    throw createIntegrityError();
                }

                return {
                    authorized: true,
                    profile: null
                };
            }

            if (typeof fullName !== "string" || !fullName.trim()) {
                throw createIntegrityError();
            }

            return {
                authorized: true,
                profile: {
                    fullName
                }
            };
        });
    }

    return {
        findOwnGroupProfile
    };
}

const groupMemberProfileService = createGroupMemberProfileService();

module.exports = {
    ...groupMemberProfileService,
    createGroupMemberProfileService,
    INTEGRITY_ERROR_CODE
};
