class IntegrationUnavailableError extends Error {
    constructor(name) {
        super(`${name} integration is not configured.`);
        this.name = "IntegrationUnavailableError";
    }
}

module.exports = { IntegrationUnavailableError };
