const GROUP_CREATION_REQUEST_FIELDS = Object.freeze([
    "groupName",
    "description",
    "village",
    "district",
    "state",
    "pinCode",
    "contactDetails",
    "proposedGroupSize"
]);

const GROUP_CREATION_REQUEST_COLUMNS = Object.freeze({
    groupName: "GROUP_NAME",
    description: "DESCRIPTION",
    village: "VILLAGE",
    district: "DISTRICT",
    state: "STATE",
    pinCode: "PIN_CODE",
    contactDetails: "CONTACT_DETAILS",
    proposedGroupSize: "PROPOSED_GROUP_SIZE"
});

const GROUP_WORKFLOW_REPOSITORY_METHODS = Object.freeze([
    "createRequest",
    "findRequestsByUser",
    "findPendingRequests",
    "decideRequest",
    "activateGroup",
    "submitMembershipRequest",
    "findMembershipRequestsByUser",
    "findPendingMembershipRequests",
    "decideMembershipRequest",
    "withdrawMembershipRequest"
]);

const GROUP_WORKFLOW_PACKAGE_PROCEDURES = Object.freeze([
    "SUBMIT_GROUP_CREATION_REQUEST",
    "SUBMIT_MEMBERSHIP_REQUEST",
    "APPROVE_GROUP_CREATION_REQUEST",
    "REJECT_GROUP_CREATION_REQUEST",
    "APPROVE_MEMBERSHIP_REQUEST",
    "REJECT_MEMBERSHIP_REQUEST",
    "WITHDRAW_GROUP_CREATION_REQUEST",
    "WITHDRAW_MEMBERSHIP_REQUEST",
    "ACTIVATE_GROUP",
    "DELEGATE_GROUP_APPROVER",
    "REVOKE_GROUP_APPROVER",
    "SUSPEND_MEMBERSHIP",
    "TERMINATE_MEMBERSHIP",
    "ADD_PLATFORM_ADMIN",
    "REVOKE_PLATFORM_ADMIN",
    "GET_MY_GROUP_CREATION_REQUESTS",
    "GET_MY_MEMBERSHIP_REQUESTS",
    "GET_PENDING_GROUP_CREATION_REQUESTS",
    "GET_PENDING_MEMBERSHIP_REQUESTS"
]);

const WORKFLOW_API_ERROR_CODES = Object.freeze({
    INVALID_CONTEXT: "WORKFLOW_INVALID_CONTEXT",
    INACTIVE_ACCOUNT: "WORKFLOW_INACTIVE_ACCOUNT",
    NOT_AUTHORIZED: "WORKFLOW_NOT_AUTHORIZED",
    NOT_FOUND: "WORKFLOW_NOT_FOUND",
    INVALID_INPUT: "WORKFLOW_INVALID_INPUT",
    IDEMPOTENCY_CONFLICT: "WORKFLOW_IDEMPOTENCY_CONFLICT",
    PENDING_CONFLICT: "WORKFLOW_PENDING_CONFLICT",
    MEMBERSHIP_CONFLICT: "WORKFLOW_MEMBERSHIP_CONFLICT",
    INVALID_TRANSITION: "WORKFLOW_INVALID_TRANSITION",
    GROUP_CODE_CONFLICT: "WORKFLOW_GROUP_CODE_CONFLICT",
    LAST_ADMIN: "WORKFLOW_LAST_ADMIN",
    INTEGRITY_FAILURE: "WORKFLOW_INTEGRITY_FAILURE",
    UNAVAILABLE: "WORKFLOW_UNAVAILABLE"
});

function decodePublicRequestId(value) {
    if (typeof value !== "string" || !/^[0-9a-f]{32}$/i.test(value)) {
        throw new TypeError("A 32-character hexadecimal public request ID is required.");
    }
    const bytes = Buffer.from(value, "hex");
    if (bytes.length !== 16) {
        throw new TypeError("Public request ID must decode to exactly 16 bytes.");
    }
    return bytes;
}

function encodePublicRequestId(value) {
    if (!Buffer.isBuffer(value) || value.length !== 16) {
        throw new TypeError("Oracle public request ID must be a 16-byte buffer.");
    }
    return value.toString("hex");
}

module.exports = {
    GROUP_CREATION_REQUEST_FIELDS,
    GROUP_CREATION_REQUEST_COLUMNS,
    GROUP_WORKFLOW_REPOSITORY_METHODS,
    GROUP_WORKFLOW_PACKAGE_PROCEDURES,
    WORKFLOW_API_ERROR_CODES,
    decodePublicRequestId,
    encodePublicRequestId
};
