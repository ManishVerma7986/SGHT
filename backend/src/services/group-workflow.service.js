const {
    normalizeRejectionReason,
    validateGroupRequest
} = require("../domain/group-workflow");
const {
    createUnavailableGroupWorkflowRepository
} = require("../repositories/group-workflow.repository");
const {
    GROUP_WORKFLOW_PACKAGE_PROCEDURES,
    GROUP_WORKFLOW_REPOSITORY_METHODS
} = require("../domain/workflow-database-contract");

function isPositiveSafeInteger(value) {
    return typeof value === "number" &&
        Number.isSafeInteger(value) &&
        value > 0;
}

function validateIdempotencyKey(value) {
    return typeof value === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            .test(value);
}

function validateGroupCode(value) {
    return typeof value === "string" &&
        /^[A-Za-z0-9][A-Za-z0-9-]{0,49}$/.test(value);
}

function validateMembershipRejectionReason(value) {
    const reason = normalizeRejectionReason(value);
    return reason && reason.length >= 10 ? reason : null;
}

function createGroupWorkflowService({
    repository = createUnavailableGroupWorkflowRepository()
} = {}) {
    async function submitRequest(userId, idempotencyKey, input) {
        if (!isPositiveSafeInteger(userId)) {
            throw new TypeError("Authenticated user identity is required.");
        }
        if (!validateIdempotencyKey(idempotencyKey)) {
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
            const normalizedReason = validateMembershipRejectionReason(reason);
            if (!normalizedReason) {
                const error = new TypeError(
                    "A rejection reason of at least 10 characters is required."
                );
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
            !/^[A-Za-z0-9][A-Za-z0-9-]{0,49}$/.test(groupId)
        ) {
            throw new TypeError("A valid group code is required.");
        }
        return repository.activateGroup(adminUserId, groupId);
    }

    async function submitMembershipRequest(userId, idempotencyKey, groupCode) {
        if (!isPositiveSafeInteger(userId)) {
            throw new TypeError("Authenticated user identity is required.");
        }
        if (!validateIdempotencyKey(idempotencyKey)) {
            throw new TypeError("A valid idempotency key is required.");
        }
        if (!validateGroupCode(groupCode)) {
            throw new TypeError("A valid group code is required.");
        }
        return repository.submitMembershipRequest(
            userId,
            idempotencyKey.toLowerCase(),
            groupCode
        );
    }

    async function findOwnMembershipRequests(userId) {
        if (!isPositiveSafeInteger(userId)) {
            throw new TypeError("Authenticated user identity is required.");
        }
        return repository.findMembershipRequestsByUser(userId);
    }

    async function findPendingMembershipRequests(userId, groupCode) {
        if (!isPositiveSafeInteger(userId)) {
            throw new TypeError("Authenticated user identity is required.");
        }
        if (!validateGroupCode(groupCode)) {
            throw new TypeError("A valid group code is required.");
        }
        return repository.findPendingMembershipRequests(userId, groupCode);
    }

    async function decideMembershipRequest(
        userId,
        requestId,
        decision,
        reason
    ) {
        if (!isPositiveSafeInteger(userId)) {
            throw new TypeError("Authenticated user identity is required.");
        }
        if (!["APPROVED", "REJECTED"].includes(decision)) {
            throw new TypeError("A valid membership request decision is required.");
        }
        if (decision === "REJECTED") {
            reason = validateMembershipRejectionReason(reason);
            if (!reason) {
                const error = new TypeError(
                    "A rejection reason of at least 10 characters is required."
                );
                error.code = "INVALID_REJECTION_REASON";
                throw error;
            }
        } else {
            reason = null;
        }
        return repository.decideMembershipRequest(
            userId,
            requestId,
            decision,
            reason
        );
    }

    async function withdrawMembershipRequest(userId, requestId) {
        if (!isPositiveSafeInteger(userId)) {
            throw new TypeError("Authenticated user identity is required.");
        }
        return repository.withdrawMembershipRequest(userId, requestId);
    }

    return Object.freeze({
        submitRequest,
        findOwnRequests,
        findPendingRequests,
        decideRequest,
        activateGroup,
        submitMembershipRequest,
        findOwnMembershipRequests,
        findPendingMembershipRequests,
        decideMembershipRequest,
        withdrawMembershipRequest
    });
}

module.exports = {
    createGroupWorkflowService,
    GROUP_WORKFLOW_PACKAGE_PROCEDURES,
    GROUP_WORKFLOW_REPOSITORY_METHODS
};
