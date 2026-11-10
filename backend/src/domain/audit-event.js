const OUTCOMES = new Set(["SUCCEEDED", "FAILED", "REJECTED"]);
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,149}$/;

function createAuditEvent(input, { now = () => new Date() } = {}) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new TypeError("An audit event is required.");
    }
    const {
        actorType,
        actorId,
        action,
        targetType,
        targetId,
        outcome,
        correlationId
    } = input;
    if (
        !["USER", "SYSTEM", "PROVIDER"].includes(actorType) ||
        typeof actorId !== "string" ||
        !IDENTIFIER.test(actorId) ||
        typeof action !== "string" ||
        !IDENTIFIER.test(action) ||
        typeof targetType !== "string" ||
        !IDENTIFIER.test(targetType) ||
        typeof targetId !== "string" ||
        !IDENTIFIER.test(targetId) ||
        !OUTCOMES.has(outcome) ||
        typeof correlationId !== "string" ||
        !IDENTIFIER.test(correlationId)
    ) {
        throw new TypeError("Audit event fields are invalid.");
    }
    const occurredAt = now();
    if (!(occurredAt instanceof Date) || !Number.isFinite(occurredAt.getTime())) {
        throw new TypeError("Audit event clock returned an invalid date.");
    }
    return Object.freeze({
        actorType,
        actorId,
        action,
        targetType,
        targetId,
        occurredAt: occurredAt.toISOString(),
        outcome,
        correlationId
    });
}

module.exports = { createAuditEvent };
