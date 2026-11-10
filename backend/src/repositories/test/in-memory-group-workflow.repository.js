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

function createInMemoryGroupWorkflowRepository({ createId = randomUUID } = {}) {
    requireTestOnlyMode();

    const requests = new Map();
    const idempotency = new Map();
    const groups = new Map();

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
                    groupId: String(groups.size + 1),
                    groupName: request.payload.groupName,
                    village: request.payload.village,
                    groupStatus: "DRAFT"
                })
                : null;
            const decidedRequest = Object.freeze({
                ...request,
                status: decision,
                decision: Object.freeze({
                    adminUserId,
                    reason,
                    groupId: group?.groupId ?? null
                })
            });

            requests.set(requestId, decidedRequest);
            if (group) {
                groups.set(group.groupId, group);
            }

            return { request: { ...decidedRequest }, replayed: false };
        },

        async activateGroup(adminUserId, groupId) {
            const group = groups.get(groupId);
            if (!group) {
                return { notFound: true };
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
            groups.set(groupId, activeGroup);
            return { group: { ...activeGroup }, replayed: false };
        }
    });
}

module.exports = {
    createInMemoryGroupWorkflowRepository
};
