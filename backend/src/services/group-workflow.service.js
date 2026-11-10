const {
    normalizeRejectionReason,
    validateGroupRequest
} = require("../domain/group-workflow");
const {
    createUnavailableGroupWorkflowRepository
} = require("../repositories/group-workflow.repository");

function isPositiveSafeInteger(value) {
    return typeof value === "number" &&
        Number.isSafeInteger(value) &&
        value > 0;
}

function createGroupWorkflowService({
    repository = createUnavailableGroupWorkflowRepository()
} = {}) {
    async function submitRequest(userId, idempotencyKey, input) {
        if (!isPositiveSafeInteger(userId)) {
            throw new TypeError("Authenticated user identity is required.");
        }
        if (
            typeof idempotencyKey !== "string" ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
                .test(idempotencyKey)
        ) {
            throw new TypeError("A valid idempotency key is required.");
        }

        const validation = validateGroupRequest(input);
        if (validation.error) {
            const error = new TypeError(validation.error);
            error.code = "INVALID_GROUP_REQUEST";
            throw error;
        }

        return repository.createRequest(
            userId,
            idempotencyKey.toLowerCase(),
            validation.value
        );
    }

    async function findOwnRequests(userId) {
        if (!isPositiveSafeInteger(userId)) {
            throw new TypeError("Authenticated user identity is required.");
        }
        return repository.findRequestsByUser(userId);
    }

    async function findPendingRequests(adminUserId) {
        if (!isPositiveSafeInteger(adminUserId)) {
            throw new TypeError("Platform administrator identity is required.");
        }
        return repository.findPendingRequests();
    }

    async function decideRequest(adminUserId, requestId, decision, reason) {
        if (!isPositiveSafeInteger(adminUserId)) {
            throw new TypeError("Platform administrator identity is required.");
        }
        if (!["APPROVED", "REJECTED"].includes(decision)) {
            throw new TypeError("A valid group request decision is required.");
        }
        if (decision === "REJECTED") {
            const normalizedReason = normalizeRejectionReason(reason);
            if (!normalizedReason) {
                const error = new TypeError("A rejection reason is required.");
                error.code = "INVALID_REJECTION_REASON";
                throw error;
            }
            reason = normalizedReason;
        } else {
            reason = null;
        }

        return repository.decideRequest(
            adminUserId,
            requestId,
            decision,
            reason
        );
    }

    async function activateGroup(adminUserId, groupId) {
        if (!isPositiveSafeInteger(adminUserId)) {
            throw new TypeError("Platform administrator identity is required.");
        }
        if (
            typeof groupId !== "string" ||
            !/^[1-9]\d*$/.test(groupId)
        ) {
            throw new TypeError("A valid group reference is required.");
        }
        return repository.activateGroup(adminUserId, groupId);
    }

    return Object.freeze({
        submitRequest,
        findOwnRequests,
        findPendingRequests,
        decideRequest,
        activateGroup
    });
}

module.exports = {
    createGroupWorkflowService
};
