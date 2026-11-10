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

function createTestRepository() {
    const previous = {
        NODE_ENV: process.env.NODE_ENV,
        SHGT_ENABLE_TEST_REPOSITORIES:
            process.env.SHGT_ENABLE_TEST_REPOSITORIES
    };
    process.env.NODE_ENV = "test";
    process.env.SHGT_ENABLE_TEST_REPOSITORIES = "1";
    try {
        return createInMemoryGroupWorkflowRepository();
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
    authorizePlatformAdmin
} = {}) {
    const repository = useTestRepository
        ? createTestRepository()
        : undefined;
    const service = createGroupWorkflowService(
        repository ? { repository } : {}
    );
    const app = express();
    app.use(express.json());
    app.use("/api/v1/group-workflow", createGroupWorkflowRouter({
        service,
        authenticate: (req, res, next) => {
            req.privyUserId = "verified-privy-user";
            return next();
        },
        authorizeUser: (req, res, next) => {
            req.shgtUser = { userId: 41 };
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
        assert.equal(response.body.request.requesterUserId, 41);
        assert.equal(response.body.request.status, "PENDING");
        assert.equal(response.body.request.payload.groupName, validPayload.groupName);
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
