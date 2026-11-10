const {
    withAuthenticatedRead
} = require("./authenticated-transaction.service");

const MAX_LIMIT = 100;
const MAX_OFFSET = 100000;

function isPositiveSafeInteger(value) {
    return typeof value === "number" &&
        Number.isSafeInteger(value) &&
        value > 0;
}

function isValidPagination(page, limit) {
    if (
        !isPositiveSafeInteger(page) ||
        !isPositiveSafeInteger(limit) ||
        limit > MAX_LIMIT
    ) {
        return false;
    }

    const offset = (page - 1) * limit;
    return Number.isSafeInteger(offset) &&
        offset <= MAX_OFFSET &&
        Number.isSafeInteger(offset + limit + 1);
}

function parseOracleIdentifier(value) {
    let identifier;

    if (typeof value === "number" && Number.isSafeInteger(value)) {
        identifier = value;
    } else if (typeof value === "string" && /^\d+$/.test(value)) {
        identifier = Number(value);
    }

    if (!isPositiveSafeInteger(identifier)) {
        throw new Error("Group member directory data integrity error.");
    }

    return identifier;
}

function isSetFlag(value) {
    if (value === 1 || value === "1") {
        return true;
    }
    if (value === 0 || value === "0") {
        return false;
    }

    throw new Error("Group member directory data integrity error.");
}

function isValidJoinedDate(value) {
    if (value === null) {
        return true;
    }

    const match = typeof value === "string"
        ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
        : null;

    if (!match) {
        return false;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    if (year < 1 || month < 1 || month > 12) {
        return false;
    }

    const isLeapYear = year % 4 === 0 &&
        (year % 100 !== 0 || year % 400 === 0);
    const daysPerMonth = [
        31,
        isLeapYear ? 29 : 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31
    ];

    return day >= 1 && day <= daysPerMonth[month - 1];
}

function createGroupMembersService({
    withAuthenticatedRead: authenticatedRead = withAuthenticatedRead
} = {}) {
    if (typeof authenticatedRead !== "function") {
        throw new Error("Authenticated read operation is required.");
    }

    async function findActiveGroupMembers(
        userId,
        groupId,
        { page = 1, limit = 25 } = {}
    ) {
        if (!isPositiveSafeInteger(userId)) {
            throw new TypeError("User ID must be a positive safe integer.");
        }
        if (!isPositiveSafeInteger(groupId)) {
            throw new TypeError("Group ID must be a positive safe integer.");
        }
        if (!isValidPagination(page, limit)) {
            throw new TypeError("Pagination values are invalid.");
        }

        const offset = (page - 1) * limit;
        const fetchCount = limit + 1;

        return authenticatedRead(userId, async (connection) => {
            const result = await connection.execute(
                `WITH active_members AS (
                    SELECT
                        M.MEMBERSHIP_ID,
                        M.USER_ID,
                        P.USER_ID AS PROFILE_USER_ID,
                        P.FULL_NAME,
                        M.MEMBER_ROLE,
                        M.MEMBERSHIP_STATUS,
                        TO_CHAR(M.JOINED_DATE, 'YYYY-MM-DD') AS JOINED_DATE
                    FROM SHGT_APP.SHG_MEMBERSHIPS M
                    LEFT JOIN SHGT_APP.MEMBER_PROFILES P
                      ON P.USER_ID = M.USER_ID
                    WHERE M.GROUP_ID = :groupId
                      AND M.MEMBERSHIP_STATUS = :membershipStatus
                ),
                checked_members AS (
                    SELECT
                        MEMBERSHIP_ID,
                        USER_ID,
                        PROFILE_USER_ID,
                        FULL_NAME,
                        MEMBER_ROLE,
                        MEMBERSHIP_STATUS,
                        JOINED_DATE,
                        COUNT(*) OVER (PARTITION BY USER_ID)
                            AS ACTIVE_MEMBERSHIP_COUNT,
                        MAX(
                            CASE WHEN PROFILE_USER_ID IS NULL THEN 1 ELSE 0 END
                        ) OVER () AS MISSING_PROFILE_FLAG
                    FROM active_members
                ),
                integrity AS (
                    SELECT
                        NVL(
                            MAX(
                                CASE
                                    WHEN ACTIVE_MEMBERSHIP_COUNT > 1 THEN 1
                                    ELSE 0
                                END
                            ),
                            0
                        ) AS DUPLICATE_MEMBERSHIP_FLAG,
                        NVL(MAX(MISSING_PROFILE_FLAG), 0)
                            AS MISSING_PROFILE_FLAG
                    FROM checked_members
                ),
                paged_members AS (
                    SELECT
                        MEMBERSHIP_ID,
                        USER_ID,
                        PROFILE_USER_ID,
                        FULL_NAME,
                        MEMBER_ROLE,
                        MEMBERSHIP_STATUS,
                        JOINED_DATE
                    FROM checked_members
                    ORDER BY JOINED_DATE ASC NULLS LAST, MEMBERSHIP_ID ASC
                    OFFSET :offset ROWS
                    FETCH NEXT :fetchCount ROWS ONLY
                )
                SELECT
                    P.MEMBERSHIP_ID,
                    P.USER_ID,
                    P.PROFILE_USER_ID,
                    P.FULL_NAME,
                    P.MEMBER_ROLE,
                    P.MEMBERSHIP_STATUS,
                    P.JOINED_DATE,
                    I.DUPLICATE_MEMBERSHIP_FLAG,
                    I.MISSING_PROFILE_FLAG
                FROM integrity I
                LEFT JOIN paged_members P ON 1 = 1
                ORDER BY P.JOINED_DATE ASC NULLS LAST, P.MEMBERSHIP_ID ASC`,
                {
                    groupId,
                    offset,
                    fetchCount,
                    membershipStatus: "ACTIVE"
                }
            );

            if (
                !result ||
                !Array.isArray(result.rows) ||
                result.rows.length === 0
            ) {
                throw new Error("Group member directory data integrity error.");
            }

            const pageRows = [];
            let hasEmptyPageSentinel = false;
            let duplicateMembership = false;
            let missingProfile = false;

            for (const row of result.rows) {
                if (!Array.isArray(row) || row.length !== 9) {
                    throw new Error("Group member directory data integrity error.");
                }

                duplicateMembership =
                    duplicateMembership || isSetFlag(row[7]);
                missingProfile = missingProfile || isSetFlag(row[8]);

                if (row[0] === null) {
                    if (row.slice(1, 7).some((value) => value !== null)) {
                        throw new Error(
                            "Group member directory data integrity error."
                        );
                    }
                    hasEmptyPageSentinel = true;
                } else {
                    pageRows.push(row);
                }
            }

            if (
                pageRows.length > fetchCount ||
                hasEmptyPageSentinel && pageRows.length > 0
            ) {
                throw new Error("Group member directory data integrity error.");
            }

            if (duplicateMembership || missingProfile) {
                throw new Error("Group member directory data integrity error.");
            }

            const members = pageRows.map((row) => {
                const membershipId = parseOracleIdentifier(row[0]);
                const memberUserId = parseOracleIdentifier(row[1]);
                const profileUserId = parseOracleIdentifier(row[2]);
                const [
                    ,
                    ,
                    ,
                    fullName,
                    memberRole,
                    membershipStatus,
                    joinedDate
                ] = row;

                if (
                    profileUserId !== memberUserId ||
                    typeof fullName !== "string" ||
                    !fullName.trim() ||
                    typeof memberRole !== "string" ||
                    !memberRole.trim() ||
                    membershipStatus !== "ACTIVE" ||
                    !isValidJoinedDate(joinedDate)
                ) {
                    throw new Error("Group member directory data integrity error.");
                }

                return {
                    membershipId,
                    fullName,
                    memberRole,
                    membershipStatus,
                    joinedDate
                };
            });

            const hasMore = members.length > limit;
            const visibleMembers = hasMore ? members.slice(0, limit) : members;

            return {
                members: visibleMembers.map((member) => ({
                    fullName: member.fullName,
                    memberRole: member.memberRole,
                    membershipStatus: member.membershipStatus,
                    joinedDate: member.joinedDate
                })),
                pagination: {
                    page,
                    limit,
                    hasMore
                }
            };
        });
    }

    return {
        findActiveGroupMembers
    };
}

const groupMembersService = createGroupMembersService();

module.exports = {
    ...groupMembersService,
    createGroupMembersService
};
