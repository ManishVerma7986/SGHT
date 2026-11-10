const test = require("node:test");
const assert = require("node:assert/strict");

const { createAuditEvent } = require("../../src/domain/audit-event");

test("creates a minimal immutable audit event without financial payloads", () => {
    const event = createAuditEvent({
        actorType: "USER",
        actorId: "user-7",
        action: "GROUP_REQUEST_SUBMITTED",
        targetType: "GROUP_REQUEST",
        targetId: "request-1",
        outcome: "SUCCEEDED",
        correlationId: "trace-1"
    }, { now: () => new Date("2026-11-11T00:00:00.000Z") });

    assert.equal(event.occurredAt, "2026-11-11T00:00:00.000Z");
    assert.equal(event.outcome, "SUCCEEDED");
    assert.equal("amount" in event, false);
    assert.ok(Object.isFrozen(event));
});

test("rejects missing actor, target, outcome, and correlation data", () => {
    assert.throws(() => createAuditEvent({}), TypeError);
});
