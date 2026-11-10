class AuditPersistenceUnavailableError extends Error {
    constructor() {
        super("Durable audit persistence is not configured.");
        this.name = "AuditPersistenceUnavailableError";
    }
}

function createUnavailableAuditRepository() {
    return Object.freeze({
        append: async () => {
            throw new AuditPersistenceUnavailableError();
        }
    });
}

module.exports = {
    AuditPersistenceUnavailableError,
    createUnavailableAuditRepository
};
