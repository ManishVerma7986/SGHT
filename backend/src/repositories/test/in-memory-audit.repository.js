const TEST_REPOSITORY_ENV = "SHGT_ENABLE_TEST_REPOSITORIES";

function createInMemoryAuditRepository() {
    if (
        process.env.NODE_ENV !== "test" ||
        process.env[TEST_REPOSITORY_ENV] !== "1"
    ) {
        throw new Error(
            "In-memory repositories require NODE_ENV=test and explicit test-repository opt-in."
        );
    }

    const events = [];
    return Object.freeze({
        async append(event) {
            const stored = Object.freeze({ ...event });
            events.push(stored);
            return stored;
        },
        async list() {
            return events.map((event) => ({ ...event }));
        }
    });
}

module.exports = { createInMemoryAuditRepository };
