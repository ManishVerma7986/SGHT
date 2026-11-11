const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");

const {
    createRequirePlatformAdmin
} = require("../../src/middleware/requirePlatformAdmin");
const {
    createGroupWorkflowRouter
} = require("../../src/routes/group-workflow.routes");
const {
    createInMemoryGroupWorkflowRepository
} = require("../../src/repositories/test/in-memory-group-workflow.repository");
const {
    createGroupWorkflowService
} = require("../../src/services/group-workflow.service");

function createTestRepository(repositoryOptions = {}) {
    const previous = {
        NODE_ENV: process.env.NODE_ENV,
        SHGT_ENABLE_TEST_REPOSITORIES:
            process.env.SHGT_ENABLE_TEST_REPOSITORIES
    };
    process.env.NODE_ENV = "test";
    process.env.SHGT_ENABLE_TEST_REPOSITORIES = "1";
    try {
        return createInMemoryGroupWorkflowRepository(repositoryOptions);
    } finally {
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
    }
}

async function createHarness({
    adminUserId = 99,
    useTestRepository = true,
    authorizePlatformAdmin,
    authenticatedUserId = 41,
    repositoryOptions = {}
} = {}) {
    const repository = useTestRepository
        ? createTestRepository(repositoryOptions)
        : undefined;
    const service = createGroupWorkflowService(
        repository ? { repository } : {}
    );
    let currentUserId = authenticatedUserId;
    const app = express();
    app.use(express.json());
    app.use("/api/v1/group-workflow", createGroupWorkflowRouter({
        service,
        authenticate: (req, res, next) => {
            req.privyUserId = "verified-privy-user";
            return next();
        },
        authorizeUser: (req, res, next) => {
            req.shgtUser = { userId: currentUserId };
            return next();
        },
        authorizePlatformAdmin: authorizePlatformAdmin ||
            createRequirePlatformAdmin({
                resolvePlatformAdmin: async (userId) =>
                    userId === adminUserId ? { userId } : null
            })
    }));

    const server = http.createServer(app);
    await new Promise((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
        server.listen(0, "127.0.0.1");
    });

    return {
        setAuthenticatedUserId(userId) {
            currentUserId = userId;
        },
        async request(path, { method = "GET", headers = {}, body } = {}) {
            const address = server.address();
            const response = await fetch(
                `http://127.0.0.1:${address.port}${path}`,
                {
                    method,
                    headers: {
                        ...(body ? { "Content-Type": "application/json" } : {}),
                        ...headers
                    },
                    body: body ? JSON.stringify(body) : undefined
                }
            );
            return {
                status: response.status,
                body: await response.json()
            };
        },
        async close() {
            await new Promise((resolve, reject) => {
                server.close((error) => error ? reject(error) : resolve());
            });
        }
    };
}

const validPayload = {
    groupName: "Hillview Savings Group",
    description: "A neighborhood group.",
    village: "Hillview"
};
const idempotencyKey = "2eb80bc1-45c8-4f20-a888-7757a8819975";

test("authenticated group request is submitted with verified identity and idempotency", async () => {
    const harness = await createHarness();
    try {
        const response = await harness.request("/api/v1/group-workflow/requests", {
            method: "POST",
            headers: { "Idempotency-Key": idempotencyKey },
            body: validPayload
        });

        assert.equal(response.status, 201);
        assert.equal(response.body.request.requesterUserId, undefined);
        assert.equal(response.body.request.status, "PENDING");
        assert.equal(response.body.request.payload.groupName, validPayload.groupName);

        const history = await harness.request(
            "/api/v1/group-workflow/requests/mine"
        );
        assert.equal(history.status, 200);
        assert.equal(history.body.requests[0].requesterUserId, undefined);

        harness.setAuthenticatedUserId(99);
        const decision = await harness.request(
            `/api/v1/group-workflow/admin/requests/${response.body.request.requestId}/decision`,
            { method: "POST", body: { decision: "APPROVED" } }
        );
        assert.equal(decision.status, 200);
        assert.equal(decision.body.request.decision.adminUserId, undefined);
        assert.equal(
            decision.body.request.decision.creatorMembership.userId,
            undefined
        );
        const activation = await harness.request(
            `/api/v1/group-workflow/admin/groups/${decision.body.request.decision.groupCode}/activate`,
            { method: "POST" }
        );
        assert.equal(activation.status, 409);
    } finally {
        await harness.close();
    }
});

test("invalid submission and missing idempotency key are rejected", async () => {
    const harness = await createHarness();
    try {
        const missingKey = await harness.request(
            "/api/v1/group-workflow/requests",
            { method: "POST", body: validPayload }
        );
        assert.equal(missingKey.status, 400);

        const invalid = await harness.request(
            "/api/v1/group-workflow/requests",
            {
                method: "POST",
                headers: { "Idempotency-Key": idempotencyKey },
                body: { ...validPayload, groupName: " " }
            }
        );
        assert.equal(invalid.status, 400);
    } finally {
        await harness.close();
    }
});

test("platform admin routes fail closed when no admin resolver is configured", async () => {
    const harness = await createHarness({
        authorizePlatformAdmin: createRequirePlatformAdmin()
    });
    try {
        const response = await harness.request(
            "/api/v1/group-workflow/admin/requests"
        );
        assert.equal(response.status, 503);
        assert.equal(response.body.success, false);
    } finally {
        await harness.close();
    }
});

test("verified non-admin identity is forbidden from platform approval", async () => {
    const harness = await createHarness({ adminUserId: 42 });
    try {
        const response = await harness.request(
            "/api/v1/group-workflow/admin/requests"
        );
        assert.equal(response.status, 403);
    } finally {
        await harness.close();
    }
});

test("platform administrators cannot approve their own group request", async () => {
    const harness = await createHarness({ adminUserId: 41 });
    try {
        const submission = await harness.request(
            "/api/v1/group-workflow/requests",
            {
                method: "POST",
                headers: { "Idempotency-Key": idempotencyKey },
                body: validPayload
            }
        );
        const decision = await harness.request(
            `/api/v1/group-workflow/admin/requests/${submission.body.request.requestId}/decision`,
            { method: "POST", body: { decision: "APPROVED" } }
        );

        assert.equal(decision.status, 409);
        assert.equal(decision.body.success, false);
    } finally {
        await harness.close();
    }
});

test("production routes report unavailable rather than falling back to memory", async () => {
    const harness = await createHarness({ useTestRepository: false });
    try {
        const response = await harness.request("/api/v1/group-workflow/requests", {
            method: "POST",
            headers: { "Idempotency-Key": idempotencyKey },
            body: validPayload
        });
        assert.equal(response.status, 503);
        assert.equal(response.body.success, false);
        assert.equal(response.body.request, undefined);
    } finally {
        await harness.close();
    }
});

test("membership request routes submit, review, approve, and expose public identifiers only", async () => {
    const groupCode = "ACTIVE-GROUP-01";
    const harness = await createHarness({
        repositoryOptions: {
            initialGroups: [{ groupCode, groupStatus: "ACTIVE" }],
            initialMemberships: [{
                groupCode,
                userId: 99,
                memberRole: "PRESIDENT",
                membershipStatus: "ACTIVE"
            }]
        }
    });
    try {
        const submission = await harness.request(
            "/api/v1/group-workflow/membership-requests",
            {
                method: "POST",
                headers: { "Idempotency-Key": idempotencyKey },
                body: { groupCode }
            }
        );
        assert.equal(submission.status, 201);
        assert.equal(submission.body.request.groupCode, groupCode);
        assert.equal(submission.body.request.status, "PENDING");
        assert.equal(submission.body.request.requesterUserId, undefined);

        const ownRequests = await harness.request(
            "/api/v1/group-workflow/membership-requests/mine"
        );
        assert.equal(ownRequests.status, 200);
        assert.equal(ownRequests.body.requests.length, 1);

        harness.setAuthenticatedUserId(99);
        const pending = await harness.request(
            `/api/v1/group-workflow/groups/${groupCode}/membership-requests`
        );
        assert.equal(pending.status, 200);
        assert.equal(pending.body.requests[0].requestId,
            submission.body.request.requestId);

        const decision = await harness.request(
            `/api/v1/group-workflow/membership-requests/${submission.body.request.requestId}/decision`,
            { method: "POST", body: { decision: "APPROVED" } }
        );
        assert.equal(decision.status, 200);
        assert.equal(decision.body.request.status, "APPROVED");
        assert.match(
            decision.body.request.decision.membershipRef,
            /^[0-9a-f]{32}$/
        );
        assert.equal(decision.body.request.requesterUserId, undefined);
        assert.equal(decision.body.request.decision.actorUserId, undefined);
    } finally {
        await harness.close();
    }
});

test("membership workflow authorization and production persistence fail closed", async () => {
    const groupCode = "ACTIVE-GROUP-02";
    const repositoryOptions = {
        initialGroups: [{ groupCode, groupStatus: "ACTIVE" }],
        initialMemberships: [{
            groupCode,
            userId: 99,
            memberRole: "PRESIDENT",
            membershipStatus: "ACTIVE"
        }]
    };
    const harness = await createHarness({ repositoryOptions });
    try {
        const forbidden = await harness.request(
            `/api/v1/group-workflow/groups/${groupCode}/membership-requests`
        );
        assert.equal(forbidden.status, 403);
    } finally {
        await harness.close();
    }

    const productionHarness = await createHarness({ useTestRepository: false });
    try {
        const unavailableSubmission = await productionHarness.request(
            "/api/v1/group-workflow/membership-requests",
            {
                method: "POST",
                headers: { "Idempotency-Key": idempotencyKey },
                body: { groupCode }
            }
        );
        const unavailableHistory = await productionHarness.request(
            "/api/v1/group-workflow/membership-requests/mine"
        );
        const unavailableReviewList = await productionHarness.request(
            `/api/v1/group-workflow/groups/${groupCode}/membership-requests`
        );
        const requestId = "a".repeat(32);
        const unavailableDecision = await productionHarness.request(
            `/api/v1/group-workflow/membership-requests/${requestId}/decision`,
            { method: "POST", body: { decision: "APPROVED" } }
        );
        const unavailableWithdrawal = await productionHarness.request(
            `/api/v1/group-workflow/membership-requests/${requestId}/withdraw`,
            { method: "POST" }
        );
        for (const response of [
            unavailableSubmission,
            unavailableHistory,
            unavailableReviewList,
            unavailableDecision,
            unavailableWithdrawal
        ]) {
            assert.equal(response.status, 503);
            assert.equal(response.body.success, false);
        }
        assert.equal(unavailableSubmission.body.request, undefined);
    } finally {
        await productionHarness.close();
    }
});
