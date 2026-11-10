const { createAuditEvent } = require("../domain/audit-event");
const {
    createUnavailableAuditRepository
} = require("../repositories/audit.repository");

function createAuditEventService({
    repository = createUnavailableAuditRepository(),
    now
} = {}) {
    if (!repository || typeof repository.append !== "function") {
        throw new TypeError("An audit repository is required.");
    }

    async function record(input) {
        const event = createAuditEvent(input, now ? { now } : undefined);
        return repository.append(event);
    }

    return Object.freeze({ record });
}

module.exports = { createAuditEventService };
