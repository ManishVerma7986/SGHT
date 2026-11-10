const {
    withAuthenticatedRead
} = require("./authenticated-transaction.service");

function isPositiveSafeInteger(value) {
    return typeof value === "number" &&
        Number.isSafeInteger(value) &&
        value > 0;
}

function parseOracleGroupId(value) {
    let groupId;

    if (typeof value === "number" && Number.isSafeInteger(value)) {
        groupId = value;
    } else if (typeof value === "string" && /^\d+$/.test(value)) {
        groupId = Number(value);
    }

    if (!isPositiveSafeInteger(groupId)) {
        throw new Error("Group overview data integrity error.");
    }

    return groupId;
}

function createGroupOverviewService({
    withAuthenticatedRead: authenticatedRead = withAuthenticatedRead
} = {}) {
    if (typeof authenticatedRead !== "function") {
        throw new Error("Authenticated read operation is required.");
    }

    async function findGroupOverview(userId, groupId) {
        if (!isPositiveSafeInteger(userId)) {
            throw new TypeError("User ID must be a positive safe integer.");
        }

        if (!isPositiveSafeInteger(groupId)) {
            throw new TypeError("Group ID must be a positive safe integer.");
        }

        return authenticatedRead(userId, async (connection) => {
            const result = await connection.execute(
                `SELECT
                    GROUP_ID,
                    GROUP_CODE,
                    GROUP_NAME,
                    VILLAGE,
                    DISTRICT,
                    STATE,
                    FORMATION_DATE,
                    GROUP_STATUS
                 FROM SHGT_APP.SHG_GROUPS
                 WHERE GROUP_ID = :groupId`,
                { groupId }
            );

            if (!result.rows || result.rows.length === 0) {
                return null;
            }

            if (result.rows.length > 1) {
                throw new Error("Group overview data integrity error.");
            }

            const row = result.rows[0];

            if (!Array.isArray(row) || row.length !== 8) {
                throw new Error("Group overview data integrity error.");
            }

            const [
                groupIdValue,
                groupCode,
                groupName,
                village,
                district,
                state,
                formationDate,
                groupStatus
            ] = row;
            const returnedGroupId = parseOracleGroupId(groupIdValue);

            if (returnedGroupId !== groupId) {
                throw new Error("Group overview data integrity error.");
            }

            return {
                groupId: returnedGroupId,
                groupCode,
                groupName,
                village,
                district,
                state,
                formationDate,
                groupStatus
            };
        });
    }

    return {
        findGroupOverview
    };
}

const groupOverviewService = createGroupOverviewService();

module.exports = {
    ...groupOverviewService,
    createGroupOverviewService
};
