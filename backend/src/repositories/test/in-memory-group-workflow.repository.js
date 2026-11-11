const { isDeepStrictEqual } = require("node:util");
const { randomUUID } = require("node:crypto");

const TEST_REPOSITORY_ENV = "SHGT_ENABLE_TEST_REPOSITORIES";

function requireTestOnlyMode() {
    if (
        process.env.NODE_ENV !== "test" ||
        process.env[TEST_REPOSITORY_ENV] !== "1"
    ) {
        throw new Error(
            "In-memory repositories require NODE_ENV=test and explicit test-repository opt-in."
        );
    }
}

function createInMemoryGroupWorkflowRepository({
    createId = () => randomUUID().replace(/-/g, ""),
    createGroupCode = (sequence) => `TEST-GRP-${String(sequence).padStart(4, "0")}`,
    initialGroups = [],
    initialMemberships = [],
    initialDelegations = []
} = {}) {
    requireTestOnlyMode();

    const requests = new Map();
    const idempotency = new Map();
    const groups = new Map();
    const memberships = new Map();
    const membershipRequests = new Map();
    const membershipIdempotency = new Map();
    const delegations = [...initialDelegations];

    for (const group of initialGroups) {
        if (
            !group ||
            typeof group.groupCode !== "string" ||
            !/^[A-Za-z0-9][A-Za-z0-9-]{0,49}$/.test(group.groupCode) ||
            !["DRAFT", "ACTIVE", "SUSPENDED", "CLOSED"].includes(
                group.groupStatus
            )
        ) {
            throw new TypeError("Invalid initial test group.");
        }
        if (groups.has(group.groupCode)) {
            throw new TypeError("Duplicate initial test group.");
        }
        groups.set(group.groupCode, Object.freeze({ ...group }));
    }

    for (const membership of initialMemberships) {
        if (
            !membership ||
            !groups.has(membership.groupCode) ||
            !Number.isSafeInteger(membership.userId) ||
            membership.userId <= 0 ||
            !["PRESIDENT", "SECRETARY", "TREASURER", "MEMBER"].includes(
                membership.memberRole
            ) ||
            !["PENDING", "ACTIVE", "SUSPENDED", "LEFT", "REJECTED"].includes(
                membership.membershipStatus
            ) ||
            (membership.membershipRef !== undefined &&
                !/^[0-9a-f]{32}$/i.test(membership.membershipRef))
        ) {
            throw new TypeError("Invalid initial test membership.");
        }
        const key = `${membership.groupCode}:${membership.userId}`;
        if (memberships.has(key)) {
            throw new TypeError("Duplicate initial test membership.");
        }
        memberships.set(key, Object.freeze({
            ...membership,
            membershipRef: membership.membershipRef || createId()
        }));
    }

    for (const delegation of delegations) {
        if (
            !delegation ||
            typeof delegation.groupCode !== "string" ||
            !groups.has(delegation.groupCode) ||
            !Number.isSafeInteger(delegation.presidentUserId) ||
            delegation.presidentUserId <= 0 ||
            !Number.isSafeInteger(delegation.delegateUserId) ||
            delegation.delegateUserId <= 0 ||
            typeof delegation.presidentMembershipRef !== "string" ||
            !/^[0-9a-f]{32}$/i.test(delegation.presidentMembershipRef) ||
            typeof delegation.delegateMembershipRef !== "string" ||
            !/^[0-9a-f]{32}$/i.test(delegation.delegateMembershipRef)
        ) {
            throw new TypeError("Invalid initial test delegation.");
        }
    }

    function hasApprovalAuthority(userId, groupCode) {
        const group = groups.get(groupCode);
        if (!group || group.groupStatus !== "ACTIVE") {
            return false;
        }

        const actingMembership = memberships.get(`${groupCode}:${userId}`);
        if (
            actingMembership?.membershipStatus === "ACTIVE" &&
            actingMembership.memberRole === "PRESIDENT"
        ) {
            return true;
        }

        return delegations.some((delegation) => {
            if (
                delegation.groupCode !== groupCode ||
                delegation.delegateUserId !== userId
            ) {
                return false;
            }
            const president = memberships.get(
                `${groupCode}:${delegation.presidentUserId}`
            );
            const delegate = memberships.get(
                `${groupCode}:${delegation.delegateUserId}`
            );
            return president?.membershipStatus === "ACTIVE" &&
                president.memberRole === "PRESIDENT" &&
                president.membershipRef === delegation.presidentMembershipRef &&
                delegate?.membershipStatus === "ACTIVE" &&
                ["SECRETARY", "TREASURER"].includes(delegate.memberRole) &&
                delegate.membershipRef === delegation.delegateMembershipRef;
        });
    }

    function hasActivePresident(groupCode) {
        return [...memberships.values()].some(
            (membership) =>
                membership.groupCode === groupCode &&
                membership.memberRole === "PRESIDENT" &&
                membership.membershipStatus === "ACTIVE"
        );
    }

    return Object.freeze({
        async createRequest(userId, key, payload) {
            const idempotencyKey = `${userId}:${key}`;
            const existing = idempotency.get(idempotencyKey);
            if (existing) {
                if (!isDeepStrictEqual(existing.payload, payload)) {
                    return { conflict: true };
                }
                return {
                    request: existing.request,
                    replayed: true
                };
            }

            const request = Object.freeze({
                requestId: createId(),
                requesterUserId: userId,
                status: "PENDING",
                payload: Object.freeze({ ...payload }),
                decision: null
            });
            requests.set(request.requestId, request);
            idempotency.set(idempotencyKey, { payload, request });

            return { request, replayed: false };
        },

        async findRequestsByUser(userId) {
            return [...requests.values()]
                .filter((request) => request.requesterUserId === userId)
                .map((request) => ({ ...request }));
        },

        async findPendingRequests() {
            return [...requests.values()]
                .filter((request) => request.status === "PENDING")
                .map((request) => ({ ...request }));
        },

        async decideRequest(adminUserId, requestId, decision, reason) {
            const request = requests.get(requestId);
            if (!request) {
                return { notFound: true };
            }
            if (request.requesterUserId === adminUserId) {
                return { conflict: true };
            }

            if (request.status !== "PENDING") {
                if (
                    request.status === decision &&
                    request.decision?.reason === reason
                ) {
                    return { request: { ...request }, replayed: true };
                }
                return { conflict: true };
            }

            const group = decision === "APPROVED"
                ? Object.freeze({
                    groupCode: createGroupCode(groups.size + 1),
                    groupName: request.payload.groupName,
                    village: request.payload.village,
                    groupStatus: "DRAFT"
                })
                : null;
            const creatorMembership = group
                ? Object.freeze({
                    groupCode: group.groupCode,
                    userId: request.requesterUserId,
                    memberRole: "MEMBER",
                    membershipStatus: "ACTIVE",
                    membershipRef: createId()
                })
                : null;
            const decidedRequest = Object.freeze({
                ...request,
                status: decision,
                decision: Object.freeze({
                    adminUserId,
                    reason,
                    groupCode: group?.groupCode ?? null,
                    creatorMembership
                })
            });

            requests.set(requestId, decidedRequest);
            if (group) {
                groups.set(group.groupCode, group);
                memberships.set(
                    `${group.groupCode}:${request.requesterUserId}`,
                    creatorMembership
                );
            }

            return { request: { ...decidedRequest }, replayed: false };
        },

        async activateGroup(adminUserId, groupCode) {
            const group = groups.get(groupCode);
            if (!group) {
                return { notFound: true };
            }
            if (!hasActivePresident(groupCode)) {
                return { conflict: true, reason: "INITIAL_LEADERSHIP_REQUIRED" };
            }
            if (group.groupStatus !== "DRAFT") {
                if (group.groupStatus === "ACTIVE") {
                    return { group: { ...group }, replayed: true };
                }
                return { conflict: true };
            }
            const activeGroup = Object.freeze({
                ...group,
                groupStatus: "ACTIVE",
                activatedByUserId: adminUserId
            });
            groups.set(groupCode, activeGroup);
            return { group: { ...activeGroup }, replayed: false };
        },

        async submitMembershipRequest(userId, key, groupCode) {
            const idempotencyKey = `${userId}:${key}`;
            const existing = membershipIdempotency.get(idempotencyKey);
            if (existing) {
                if (existing.groupCode !== groupCode) {
                    return { conflict: true };
                }
                return {
                    request: membershipRequests.get(existing.requestId),
                    replayed: true,
                    simulated: true
                };
            }

            const group = groups.get(groupCode);
            if (!group || group.groupStatus !== "ACTIVE") {
                return { notFound: true };
            }
            if (!hasActivePresident(groupCode)) {
                return { conflict: true, reason: "NO_ACTIVE_PRESIDENT" };
            }

            const membershipKey = `${groupCode}:${userId}`;
            const currentMembership = memberships.get(membershipKey);
            if (
                currentMembership &&
                ["PENDING", "ACTIVE", "SUSPENDED"].includes(
                    currentMembership.membershipStatus
                )
            ) {
                return { conflict: true };
            }

            const hasPending = [...membershipRequests.values()].some(
                (request) =>
                    request.requesterUserId === userId &&
                    request.groupCode === groupCode &&
                    request.status === "PENDING"
            );
            if (hasPending) {
                return { conflict: true };
            }

            const request = Object.freeze({
                requestId: createId(),
                requesterUserId: userId,
                groupCode,
                status: "PENDING",
                decision: null
            });
            membershipRequests.set(request.requestId, request);
            membershipIdempotency.set(idempotencyKey, {
                groupCode,
                requestId: request.requestId
            });
            return { request, replayed: false, simulated: true };
        },

        async findMembershipRequestsByUser(userId) {
            return {
                requests: [...membershipRequests.values()]
                    .filter((request) => request.requesterUserId === userId)
                    .map((request) => ({ ...request })),
                simulated: true
            };
        },

        async findPendingMembershipRequests(userId, groupCode) {
            if (!hasApprovalAuthority(userId, groupCode)) {
                return { forbidden: true };
            }
            return {
                requests: [...membershipRequests.values()]
                    .filter((request) =>
                        request.groupCode === groupCode &&
                        request.status === "PENDING"
                    )
                    .map((request) => ({ ...request })),
                simulated: true
            };
        },

        async decideMembershipRequest(userId, requestId, decision, reason) {
            const request = membershipRequests.get(requestId);
            if (!request) {
                return { notFound: true };
            }
            if (!hasApprovalAuthority(userId, request.groupCode)) {
                return { forbidden: true };
            }
            if (request.requesterUserId === userId) {
                return { conflict: true };
            }
            if (request.status !== "PENDING") {
                if (
                    request.status === decision &&
                    request.decision?.reason === reason
                ) {
                    return {
                        request: { ...request },
                        replayed: true,
                        simulated: true
                    };
                }
                return { conflict: true };
            }

            const existingMembership = memberships.get(
                `${request.groupCode}:${request.requesterUserId}`
            );
            if (
                existingMembership &&
                ["PENDING", "ACTIVE", "SUSPENDED"].includes(
                    existingMembership.membershipStatus
                )
            ) {
                return { conflict: true };
            }

            const membership = decision === "APPROVED"
                ? Object.freeze({
                    groupCode: request.groupCode,
                    userId: request.requesterUserId,
                    memberRole: "MEMBER",
                    membershipStatus: "ACTIVE",
                    membershipRef: createId()
                })
                : null;
            if (membership) {
                memberships.set(
                    `${request.groupCode}:${request.requesterUserId}`,
                    membership
                );
            }
            const decidedRequest = Object.freeze({
                ...request,
                status: decision,
                decision: Object.freeze({
                    actorUserId: userId,
                    reason,
                    membershipRef: membership?.membershipRef ?? null
                })
            });
            membershipRequests.set(requestId, decidedRequest);
            return {
                request: { ...decidedRequest },
                replayed: false,
                simulated: true
            };
        },

        async withdrawMembershipRequest(userId, requestId) {
            const request = membershipRequests.get(requestId);
            if (!request) {
                return { notFound: true };
            }
            if (request.requesterUserId !== userId) {
                return { forbidden: true };
            }
            if (request.status !== "PENDING") {
                if (request.status === "WITHDRAWN") {
                    return {
                        request: { ...request },
                        replayed: true,
                        simulated: true
                    };
                }
                return { conflict: true };
            }
            const withdrawnRequest = Object.freeze({
                ...request,
                status: "WITHDRAWN",
                decision: Object.freeze({
                    actorUserId: userId,
                    reason: null,
                    membershipRef: null
                })
            });
            membershipRequests.set(requestId, withdrawnRequest);
            return {
                request: { ...withdrawnRequest },
                replayed: false,
                simulated: true
            };
        }
    });
}

module.exports = {
    createInMemoryGroupWorkflowRepository
};
