const {
    findActiveGroupMembership
} = require("../services/group-membership.service");

function parseGroupId(value) {
    if (
        typeof value !== "string" ||
        !/^\d+$/.test(value)
    ) {
        return null;
    }

    const groupId = Number(value);

    if (!Number.isSafeInteger(groupId) || groupId <= 0) {
        return null;
    }

    return groupId;
}

function isValidMembership(membership, requestedGroupId) {
    return (
        membership !== null &&
        typeof membership === "object" &&
        !Array.isArray(membership) &&
        Number.isSafeInteger(membership.membershipId) &&
        membership.membershipId > 0 &&
        Number.isSafeInteger(membership.groupId) &&
        membership.groupId > 0 &&
        membership.groupId === requestedGroupId &&
        ["PRESIDENT", "SECRETARY", "TREASURER", "MEMBER"].includes(
            membership.memberRole
        )
    );
}

function getErrorMessage(error) {
    try {
        return String(error?.message ?? String(error));
    } catch {
        return "Unknown error";
    }
}

function createRequireGroupMembership({
    findMembership = findActiveGroupMembership
} = {}) {
    if (typeof findMembership !== "function") {
        throw new Error("Group membership lookup is required.");
    }

    return async function requireGroupMembership(req, res, next) {
        const userId = req.shgtUser?.userId;

        if (
            typeof userId !== "number" ||
            !Number.isSafeInteger(userId) ||
            userId <= 0
        ) {
            return res.status(401).json({
                success: false,
                message: "An authenticated SHGT account is required."
            });
        }

        const groupId = parseGroupId(req.params?.groupId);

        if (groupId === null) {
            return res.status(400).json({
                success: false,
                message: "A valid group ID is required."
            });
        }

        let membership;

        try {
            membership = await findMembership(userId, groupId);
        } catch (error) {
            console.error(
                "Group membership authorization failed:",
                getErrorMessage(error)
            );

            return res.status(503).json({
                success: false,
                message: "Unable to verify group membership. Please try again."
            });
        }

        if (!membership) {
            return res.status(404).json({
                success: false,
                message: "Active membership in this group was not found."
            });
        }

        if (!isValidMembership(membership, groupId)) {
            return res.status(500).json({
                success: false,
                message: "Internal authorization error."
            });
        }

        req.groupMembership = {
            membershipId: membership.membershipId,
            groupId: membership.groupId,
            memberRole: membership.memberRole
        };

        return next();
    };
}

const requireGroupMembership = createRequireGroupMembership();

module.exports = requireGroupMembership;
module.exports.createRequireGroupMembership = createRequireGroupMembership;
