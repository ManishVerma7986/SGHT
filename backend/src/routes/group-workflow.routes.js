const express = require("express");

const requirePrivyAuth = require("../middleware/requirePrivyAuth");
const requireShgtUser = require("../middleware/requireShgtUser");
const {
    createRequirePlatformAdmin
} = require("../middleware/requirePlatformAdmin");
const {
    createGroupWorkflowService
} = require("../services/group-workflow.service");
const {
    WorkflowPersistenceUnavailableError
} = require("../repositories/group-workflow.repository");
const { decodePublicRequestId } = require("../domain/workflow-database-contract");

function createGroupWorkflowRouter({
    service = createGroupWorkflowService(),
    authenticate = requirePrivyAuth,
    authorizeUser = requireShgtUser,
    authorizePlatformAdmin = createRequirePlatformAdmin()
} = {}) {
    const router = express.Router();

    router.post("/requests", authenticate, authorizeUser, async (req, res) => {
        try {
            const result = await service.submitRequest(
                req.shgtUser.userId,
                req.get("Idempotency-Key"),
                req.body
            );
            if (result.conflict) {
                return res.status(409).json({
                    success: false,
                    message: "Idempotency key was already used for different request details."
                });
            }
            return res.status(result.replayed ? 200 : 201).json({
                success: true,
                replayed: result.replayed,
                request: toPublicGroupRequest(result.request)
            });
        } catch (error) {
            if (error.code === "INVALID_GROUP_REQUEST") {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }
            if (
                error instanceof TypeError &&
                /idempotency key/i.test(error.message)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "A valid Idempotency-Key header is required."
                });
            }
            return handleFailure(res, "submit request", error);
        }
    });

    router.get("/requests/mine", authenticate, authorizeUser, async (req, res) => {
        try {
            const requests = await service.findOwnRequests(req.shgtUser.userId);
            return res.status(200).json({
                success: true,
                requests: requests.map(toPublicGroupRequest)
            });
        } catch (error) {
            return handleFailure(res, "list own requests", error);
        }
    });

    router.post(
        "/membership-requests",
        authenticate,
        authorizeUser,
        async (req, res) => {
            try {
                const result = await service.submitMembershipRequest(
                    req.shgtUser.userId,
                    req.get("Idempotency-Key"),
                    req.body?.groupCode
                );
                if (result.notFound) {
                    return res.status(404).json({
                        success: false,
                        message: "An active group with that code was not found."
                    });
                }
                if (result.conflict) {
                    return res.status(409).json({
                        success: false,
                        message: result.reason === "NO_ACTIVE_PRESIDENT"
                            ? "This group has no active membership approver."
                            : "A current membership or pending request already exists."
                    });
                }
                return res.status(result.replayed ? 200 : 201).json({
                    success: true,
                    replayed: result.replayed,
                    simulated: result.simulated === true,
                    request: toPublicMembershipRequest(result.request)
                });
            } catch (error) {
                if (
                    error instanceof TypeError &&
                    /idempotency key/i.test(error.message)
                ) {
                    return res.status(400).json({
                        success: false,
                        message: "A valid Idempotency-Key header is required."
                    });
                }
                if (error instanceof TypeError) {
                    return res.status(400).json({
                        success: false,
                        message: error.message
                    });
                }
                return handleFailure(res, "submit membership request", error);
            }
        }
    );

    router.get(
        "/membership-requests/mine",
        authenticate,
        authorizeUser,
        async (req, res) => {
            try {
                const requests = await service.findOwnMembershipRequests(
                    req.shgtUser.userId
                );
                return res.status(200).json({
                    success: true,
                    simulated: requests.simulated === true,
                    requests: requests.requests.map(toPublicMembershipRequest)
                });
            } catch (error) {
                return handleFailure(res, "list own membership requests", error);
            }
        }
    );

    router.get(
        "/groups/:groupCode/membership-requests",
        authenticate,
        authorizeUser,
        async (req, res) => {
            try {
                const result = await service.findPendingMembershipRequests(
                    req.shgtUser.userId,
                    req.params.groupCode
                );
                if (result.forbidden) {
                    return res.status(403).json({
                        success: false,
                        message: "You cannot review requests for this group."
                    });
                }
                return res.status(200).json({
                    success: true,
                    simulated: result.simulated === true,
                    requests: result.requests.map(toPublicMembershipRequest)
                });
            } catch (error) {
                if (error instanceof TypeError) {
                    return res.status(400).json({
                        success: false,
                        message: error.message
                    });
                }
                return handleFailure(
                    res,
                    "list pending membership requests",
                    error
                );
            }
        }
    );

    router.post(
        "/membership-requests/:requestId/decision",
        authenticate,
        authorizeUser,
        async (req, res) => {
            const { decision, reason } = req.body || {};
            try {
                const requestId = decodePublicRequestId(req.params.requestId)
                    .toString("hex");
                const result = await service.decideMembershipRequest(
                    req.shgtUser.userId,
                    requestId,
                    decision,
                    reason
                );
                if (result.notFound) {
                    return res.status(404).json({
                        success: false,
                        message: "Membership request not found."
                    });
                }
                if (result.forbidden) {
                    return res.status(403).json({
                        success: false,
                        message: "You cannot review this membership request."
                    });
                }
                if (result.conflict) {
                    return res.status(409).json({
                        success: false,
                        message: "Membership request cannot receive this decision."
                    });
                }
                return res.status(200).json({
                    success: true,
                    replayed: result.replayed,
                    simulated: result.simulated === true,
                    request: toPublicMembershipRequest(result.request)
                });
            } catch (error) {
                if (
                    error.code === "INVALID_REJECTION_REASON" ||
                    error instanceof TypeError
                ) {
                    return res.status(400).json({
                        success: false,
                        message: error.message
                    });
                }
                return handleFailure(res, "decide membership request", error);
            }
        }
    );

    router.post(
        "/membership-requests/:requestId/withdraw",
        authenticate,
        authorizeUser,
        async (req, res) => {
            try {
                const requestId = decodePublicRequestId(req.params.requestId)
                    .toString("hex");
                const result = await service.withdrawMembershipRequest(
                    req.shgtUser.userId,
                    requestId
                );
                if (result.notFound) {
                    return res.status(404).json({
                        success: false,
                        message: "Membership request not found."
                    });
                }
                if (result.forbidden) {
                    return res.status(403).json({
                        success: false,
                        message: "You cannot withdraw this membership request."
                    });
                }
                if (result.conflict) {
                    return res.status(409).json({
                        success: false,
                        message: "Only pending membership requests can be withdrawn."
                    });
                }
                return res.status(200).json({
                    success: true,
                    replayed: result.replayed,
                    simulated: result.simulated === true,
                    request: toPublicMembershipRequest(result.request)
                });
            } catch (error) {
                if (error instanceof TypeError) {
                    return res.status(400).json({
                        success: false,
                        message: error.message
                    });
                }
                return handleFailure(res, "withdraw membership request", error);
            }
        }
    );

    router.get(
        "/admin/requests",
        authenticate,
        authorizeUser,
        authorizePlatformAdmin,
        async (req, res) => {
            try {
                const requests = await service.findPendingRequests(
                    req.platformAdmin.userId
                );
                return res.status(200).json({
                    success: true,
                    requests: requests.map(toPublicGroupRequest)
                });
            } catch (error) {
                return handleFailure(res, "list pending requests", error);
            }
        }
    );

    router.post(
        "/admin/requests/:requestId/decision",
        authenticate,
        authorizeUser,
        authorizePlatformAdmin,
        async (req, res) => {
            const { decision, reason } = req.body || {};
            try {
                const requestId = decodePublicRequestId(req.params.requestId);
                const result = await service.decideRequest(
                    req.platformAdmin.userId,
                    requestId.toString("hex"),
                    decision,
                    reason
                );
                if (result.notFound) {
                    return res.status(404).json({
                        success: false,
                        message: "Group request not found."
                    });
                }
                if (result.conflict) {
                    return res.status(409).json({
                        success: false,
                        message: "Group request cannot receive this decision."
                    });
                }
                return res.status(200).json({
                    success: true,
                    replayed: result.replayed,
                    request: toPublicGroupRequest(result.request)
                });
            } catch (error) {
                if (
                    error.code === "INVALID_REJECTION_REASON" ||
                    error instanceof TypeError
                ) {
                    return res.status(400).json({
                        success: false,
                        message: error.message
                    });
                }
                return handleFailure(res, "decide request", error);
            }
        }
    );

    router.post(
        "/admin/groups/:groupCode/activate",
        authenticate,
        authorizeUser,
        authorizePlatformAdmin,
        async (req, res) => {
            try {
                const result = await service.activateGroup(
                    req.platformAdmin.userId,
                    req.params.groupCode
                );
                if (result.notFound) {
                    return res.status(404).json({
                        success: false,
                        message: "Group not found."
                    });
                }
                if (result.conflict) {
                    return res.status(409).json({
                        success: false,
                        message: result.reason === "INITIAL_LEADERSHIP_REQUIRED"
                            ? "Group activation requires an approved initial leadership and membership-approval path."
                            : "Group cannot be activated from its current status."
                    });
                }
                return res.status(200).json({
                    success: true,
                    replayed: result.replayed,
                    group: result.group
                });
            } catch (error) {
                if (error instanceof TypeError) {
                    return res.status(400).json({
                        success: false,
                        message: error.message
                    });
                }
                return handleFailure(res, "activate group", error);
            }
        }
    );

    return router;
}

function toPublicMembershipRequest(request) {
    if (!request || typeof request !== "object") {
        throw new Error("Membership workflow returned an invalid request.");
    }
    return {
        requestId: request.requestId,
        groupCode: request.groupCode,
        status: request.status,
        decision: request.decision
            ? {
                reason: request.decision.reason ?? null,
                membershipRef: request.decision.membershipRef ?? null
            }
            : null
    };
}

function toPublicGroupRequest(request) {
    if (!request || typeof request !== "object") {
        throw new Error("Group workflow returned an invalid request.");
    }
    return {
        requestId: request.requestId,
        status: request.status,
        payload: request.payload,
        decision: request.decision
            ? {
                reason: request.decision.reason ?? null,
                groupCode: request.decision.groupCode ?? null,
                creatorMembership: request.decision.creatorMembership
                    ? {
                        membershipRef:
                            request.decision.creatorMembership.membershipRef,
                        memberRole:
                            request.decision.creatorMembership.memberRole,
                        membershipStatus:
                            request.decision.creatorMembership.membershipStatus
                    }
                    : null
            }
            : null
    };
}

function handleFailure(res, operation, error) {
    if (!(error instanceof WorkflowPersistenceUnavailableError)) {
        console.error("Group workflow operation failed.", {
            operation,
            errorName: error?.name,
            errorCode: error?.code
        });
        return res.status(500).json({
            success: false,
            message: "Unable to complete the group workflow operation."
        });
    }

    return res.status(503).json({
        success: false,
        message: "Group workflow persistence is unavailable."
    });
}

module.exports = {
    createGroupWorkflowRouter
};
