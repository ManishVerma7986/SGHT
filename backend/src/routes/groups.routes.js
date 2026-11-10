const express = require("express");

const requirePrivyAuth = require("../middleware/requirePrivyAuth");
const requireShgtUser = require("../middleware/requireShgtUser");
const requireGroupMembership = require("../middleware/requireGroupMembership");
const {
    findGroupOverview: findOverview
} = require("../services/group-overview.service");
const {
    findActiveGroupMembers
} = require("../services/group-members.service");
const {
    findOwnGroupProfile,
    INTEGRITY_ERROR_CODE
} = require("../services/group-member-profile.service");

const MAX_MEMBER_LIMIT = 100;
const MAX_OFFSET = 100000;

function parsePaginationValue(value, defaultValue) {
    if (value === undefined) {
        return defaultValue;
    }

    if (typeof value !== "string" || !/^\d+$/.test(value)) {
        return null;
    }

    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0
        ? parsed
        : null;
}

function parsePagination(query) {
    const page = parsePaginationValue(query.page, 1);
    const limit = parsePaginationValue(query.limit, 25);

    if (
        page === null ||
        limit === null ||
        limit > MAX_MEMBER_LIMIT
    ) {
        return null;
    }

    const offset = (page - 1) * limit;
    if (
        !Number.isSafeInteger(offset) ||
        offset > MAX_OFFSET ||
        !Number.isSafeInteger(offset + limit + 1)
    ) {
        return null;
    }

    return { page, limit };
}

function getErrorMessage(error) {
    try {
        return String(error?.message ?? String(error));
    } catch {
        return "Unknown error";
    }
}

function createGroupsRouter({
    requirePrivyAuth: authenticate = requirePrivyAuth,
    requireShgtUser: authorizeShgtUser = requireShgtUser,
    requireGroupMembership: authorizeGroupMembership = requireGroupMembership,
    findGroupOverview = findOverview,
    findGroupMembers = findActiveGroupMembers,
    findGroupMemberProfile = findOwnGroupProfile
} = {}) {
    const router = express.Router();

    router.get(
        "/:groupId/members/me",
        authenticate,
        authorizeShgtUser,
        authorizeGroupMembership,
        async (req, res) => {
            try {
                const result = await findGroupMemberProfile(
                    req.shgtUser.userId,
                    req.groupMembership.groupId
                );

                if (!result || result.authorized !== true) {
                    return res.status(404).json({
                        success: false,
                        message: "Active membership in this group was not found."
                    });
                }

                if (result.profile === null) {
                    return res.status(404).json({
                        success: false,
                        message: "Member profile not found."
                    });
                }

                if (
                    typeof result.profile !== "object" ||
                    Array.isArray(result.profile) ||
                    typeof result.profile.fullName !== "string" ||
                    !result.profile.fullName.trim()
                ) {
                    const error = new Error(
                        "Group member profile response is invalid."
                    );
                    error.code = INTEGRITY_ERROR_CODE;
                    throw error;
                }

                return res.status(200).json({
                    success: true,
                    profile: {
                        fullName: result.profile.fullName
                    }
                });
            } catch (error) {
                if (error?.code === INTEGRITY_ERROR_CODE) {
                    console.error(
                        "Group member profile integrity check failed:",
                        getErrorMessage(error)
                    );

                    return res.status(500).json({
                        success: false,
                        message: "Internal server error."
                    });
                }

                console.error(
                    "Group member profile lookup failed:",
                    getErrorMessage(error)
                );

                return res.status(503).json({
                    success: false,
                    message: "Unable to retrieve member profile. Please try again."
                });
            }
        }
    );

    router.get(
        "/:groupId/members",
        authenticate,
        authorizeShgtUser,
        authorizeGroupMembership,
        async (req, res) => {
            const pagination = parsePagination(req.query || {});

            if (!pagination) {
                return res.status(400).json({
                    success: false,
                    message: "Valid page and limit values are required."
                });
            }

            try {
                const directory = await findGroupMembers(
                    req.shgtUser.userId,
                    req.groupMembership.groupId,
                    pagination
                );

                if (
                    !directory ||
                    !Array.isArray(directory.members) ||
                    typeof directory.pagination?.hasMore !== "boolean"
                ) {
                    throw new Error("Group member directory response is invalid.");
                }

                return res.status(200).json({
                    success: true,
                    members: directory.members.map((member) => ({
                        fullName: member.fullName,
                        memberRole: member.memberRole,
                        membershipStatus: member.membershipStatus,
                        joinedDate: member.joinedDate
                    })),
                    pagination: {
                        page: pagination.page,
                        limit: pagination.limit,
                        hasMore: directory.pagination.hasMore
                    }
                });
            } catch (error) {
                console.error(
                    "Group member directory lookup failed:",
                    getErrorMessage(error)
                );

                return res.status(503).json({
                    success: false,
                    message: "Unable to retrieve group members. Please try again."
                });
            }
        }
    );

    router.get(
        "/:groupId",
        authenticate,
        authorizeShgtUser,
        authorizeGroupMembership,
        async (req, res) => {
            try {
                const group = await findGroupOverview(
                    req.shgtUser.userId,
                    req.groupMembership.groupId
                );

                if (!group) {
                    return res.status(404).json({
                        success: false,
                        message: "Group not found."
                    });
                }

                if (group.groupId !== req.groupMembership.groupId) {
                    return res.status(500).json({
                        success: false,
                        message: "Internal server error."
                    });
                }

                return res.status(200).json({
                    success: true,
                    group: {
                        groupId: group.groupId,
                        groupCode: group.groupCode,
                        groupName: group.groupName,
                        village: group.village,
                        district: group.district,
                        state: group.state,
                        formationDate: group.formationDate,
                        groupStatus: group.groupStatus
                    }
                });
            } catch (error) {
                console.error(
                    "Group overview lookup failed:",
                    getErrorMessage(error)
                );

                return res.status(503).json({
                    success: false,
                    message: "Unable to retrieve group overview. Please try again."
                });
            }
        }
    );

    router.get(
        "/:groupId/membership",
        authenticate,
        authorizeShgtUser,
        authorizeGroupMembership,
        (req, res) => res.status(200).json({
            success: true,
            membership: {
                membershipId: req.groupMembership.membershipId,
                groupId: req.groupMembership.groupId,
                memberRole: req.groupMembership.memberRole
            }
        })
    );

    return router;
}

module.exports = createGroupsRouter();
module.exports.createGroupsRouter = createGroupsRouter;
