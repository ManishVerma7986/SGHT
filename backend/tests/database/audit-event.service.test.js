const test = require("node:test");
const assert = require("node:assert/strict");

const {
    createInMemoryAuditRepository
} = require("../../src/repositories/test/in-memory-audit.repository");
const {
    AuditPersistenceUnavailableError
} = require("../../src/repositories/audit.repository");
const {
    createAuditEventService
} = require("../../src/services/audit-event.service");

const eventInput = {
    actorType: "USER",
    actorId: "user-7",
    action: "SAVINGS_CONTRIBUTION_REQUESTED",
    targetType: "CONTRIBUTION",
    targetId: "request-1",
    outcome: "SUCCEEDED",
    correlationId: "trace-1"
};

function withTestRepositoryEnabled(callback) {
    const previous = {
        NODE_ENV: process.env.NODE_ENV,
        SHGT_ENABLE_TEST_REPOSITORIES:
            process.env.SHGT_ENABLE_TEST_REPOSITORIES
    };
    process.env.NODE_ENV = "test";
    process.env.SHGT_ENABLE_TEST_REPOSITORIES = "1";
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

test("audit service fails closed without durable persistence", async () => {
    await assert.rejects(
        createAuditEventService().record(eventInput),
        AuditPersistenceUnavailableError
    );
});

test("test audit repository is append-only and explicitly gated", async () => {
    assert.throws(
        () => createInMemoryAuditRepository(),
        /require NODE_ENV=test and explicit test-repository opt-in/
    );

    const repository = withTestRepositoryEnabled(
        () => createInMemoryAuditRepository()
    );
    const service = createAuditEventService({
        repository,
        now: () => new Date("2026-11-11T00:00:00.000Z")
    });
    await service.record(eventInput);
    const events = await repository.list();
    assert.equal(events.length, 1);
    assert.equal(events[0].targetId, "request-1");
    assert.equal(events[0].occurredAt, "2026-11-11T00:00:00.000Z");
});
