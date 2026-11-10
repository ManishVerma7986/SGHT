const test = require("node:test");
const assert = require("node:assert/strict");

const {
    createInMemoryGroupWorkflowRepository
} = require("../../src/repositories/test/in-memory-group-workflow.repository");
const {
    createGroupWorkflowService
} = require("../../src/services/group-workflow.service");

function createService() {
    const repository = withRepositoryEnv({
        NODE_ENV: "test",
        SHGT_ENABLE_TEST_REPOSITORIES: "1"
    }, () => createInMemoryGroupWorkflowRepository());

    return createGroupWorkflowService({ repository });
}

const validPayload = Object.freeze({
    groupName: "Hillview Savings Group",
    description: "A neighborhood savings group.",
    village: "Hillview",
    district: "North District",
    state: "Example State",
    contactDetails: "group@example.test",
    proposedGroupSize: 12
});

const idempotencyKey = "2eb80bc1-45c8-4f20-a888-7757a8819975";

function withRepositoryEnv(env, callback) {
    const previous = {
        NODE_ENV: process.env.NODE_ENV,
        SHGT_ENABLE_TEST_REPOSITORIES:
            process.env.SHGT_ENABLE_TEST_REPOSITORIES
    };

    for (const key of Object.keys(previous)) {
        if (env[key] === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = env[key];
        }
    }

    try {
        return callback();
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

test("refuses to create an in-memory repository outside explicitly opted-in tests", () => {
    for (const env of [
        { NODE_ENV: "production", SHGT_ENABLE_TEST_REPOSITORIES: "1" },
        { NODE_ENV: "test" },
        { NODE_ENV: "development", SHGT_ENABLE_TEST_REPOSITORIES: "1" }
    ]) {
        withRepositoryEnv(env, () => {
            assert.throws(
                () => createInMemoryGroupWorkflowRepository(),
                /require NODE_ENV=test and explicit test-repository opt-in/
            );
        });
    }
});

test("validates and stores a group request as pending without creating an active group", async () => {
    const service = createService();
    const result = await service.submitRequest(41, idempotencyKey, validPayload);

    assert.equal(result.request.requesterUserId, 41);
    assert.equal(result.request.status, "PENDING");
    assert.equal(result.request.payload.groupName, validPayload.groupName);
    assert.equal(result.replayed, false);
    assert.deepEqual(await service.findOwnRequests(41), [result.request]);
    assert.deepEqual(await service.findPendingRequests(99), [result.request]);
});

test("same idempotency key and payload replays; changed payload conflicts", async () => {
    const service = createService();
    const first = await service.submitRequest(41, idempotencyKey, validPayload);
    const replay = await service.submitRequest(41, idempotencyKey, validPayload);

    assert.equal(replay.replayed, true);
    assert.equal(replay.request.requestId, first.request.requestId);
    assert.deepEqual(
        await service.submitRequest(41, idempotencyKey, {
            ...validPayload,
            groupName: "Different group"
        }),
        { conflict: true }
    );
});

test("requesters cannot approve their own group request", async () => {
    const service = createService();
    const submitted = await service.submitRequest(
        41,
        idempotencyKey,
        validPayload
    );

    assert.deepEqual(
        await service.decideRequest(
            41,
            submitted.request.requestId,
            "APPROVED"
        ),
        { conflict: true }
    );
});

test("approval creates a draft group and activation is a separate admin decision", async () => {
    const service = createService();
    const submitted = await service.submitRequest(
        41,
        idempotencyKey,
        validPayload
    );

    const approved = await service.decideRequest(
        99,
        submitted.request.requestId,
        "APPROVED"
    );
    assert.equal(approved.request.status, "APPROVED");
    assert.equal(approved.request.decision.adminUserId, 99);
    assert.ok(approved.request.decision.groupId);

    const activated = await service.activateGroup(
        99,
        approved.request.decision.groupId
    );
    assert.equal(activated.group.groupStatus, "ACTIVE");
    assert.equal(activated.group.activatedByUserId, 99);
});

test("rejection requires a reason and rejected requests cannot be activated", async () => {
    const service = createService();
    const submitted = await service.submitRequest(
        41,
        idempotencyKey,
        validPayload
    );

    await assert.rejects(
        service.decideRequest(
            99,
            submitted.request.requestId,
            "REJECTED",
            " "
        ),
        { code: "INVALID_REJECTION_REASON" }
    );
    const rejected = await service.decideRequest(
        99,
        submitted.request.requestId,
        "REJECTED",
        "Incomplete supporting details."
    );

    assert.equal(rejected.request.status, "REJECTED");
    assert.equal(rejected.request.decision.reason, "Incomplete supporting details.");
    assert.equal(rejected.request.decision.groupId, null);
});

test("terminal decisions replay only when identical and conflict otherwise", async () => {
    const service = createService();
    const submitted = await service.submitRequest(
        41,
        idempotencyKey,
        validPayload
    );
    const requestId = submitted.request.requestId;
    await service.decideRequest(99, requestId, "APPROVED");

    assert.equal(
        (await service.decideRequest(100, requestId, "APPROVED")).replayed,
        true
    );
    assert.deepEqual(
        await service.decideRequest(100, requestId, "REJECTED", "No"),
        { conflict: true }
    );
});

test("rejects invalid request fields, actor IDs, and decisions", async () => {
    const service = createService();
    for (const payload of [
        null,
        { ...validPayload, groupName: " " },
        { ...validPayload, groupName: "x".repeat(151) },
        { ...validPayload, proposedGroupSize: 1.5 }
    ]) {
        await assert.rejects(
            service.submitRequest(41, idempotencyKey, payload),
            { code: "INVALID_GROUP_REQUEST" }
        );
    }

    await assert.rejects(
        service.submitRequest(0, idempotencyKey, validPayload),
        /Authenticated user identity/
    );
    await assert.rejects(
        service.decideRequest(0, "request", "APPROVED"),
        /Platform administrator identity/
    );
    await assert.rejects(
        service.decideRequest(99, "request", "ACTIVE"),
        /valid group request decision/
    );
});
