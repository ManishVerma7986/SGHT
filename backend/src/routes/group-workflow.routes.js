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
                request: result.request
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
            return res.status(200).json({ success: true, requests });
        } catch (error) {
            return handleFailure(res, "list own requests", error);
        }
    });

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
                return res.status(200).json({ success: true, requests });
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
                const result = await service.decideRequest(
                    req.platformAdmin.userId,
                    req.params.requestId,
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
                    request: result.request
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
        "/admin/groups/:groupId/activate",
        authenticate,
        authorizeUser,
        authorizePlatformAdmin,
        async (req, res) => {
            try {
                const result = await service.activateGroup(
                    req.platformAdmin.userId,
                    req.params.groupId
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
                        message: "Group cannot be activated from its current status."
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
