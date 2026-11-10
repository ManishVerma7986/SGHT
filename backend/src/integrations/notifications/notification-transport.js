const { IntegrationUnavailableError } = require("../integration-error");

const CHANNELS = new Set(["EMAIL", "SMS", "PUSH"]);

function createNotificationTransport({ provider } = {}) {
    if (!provider || typeof provider.send !== "function") {
        throw new TypeError("A notification provider adapter is required.");
    }

    async function send(notification) {
        if (
            !notification ||
            typeof notification !== "object" ||
            typeof notification.recipientReference !== "string" ||
            !notification.recipientReference.trim() ||
            !CHANNELS.has(notification.channel) ||
            typeof notification.templateId !== "string" ||
            !/^[A-Za-z0-9._-]{1,100}$/.test(notification.templateId)
        ) {
            throw new TypeError("Notification request is invalid.");
        }
        const result = await provider.send(Object.freeze({
            recipientReference: notification.recipientReference,
            channel: notification.channel,
            templateId: notification.templateId,
            variables: Object.freeze({ ...(notification.variables || {}) })
        }));
        if (
            !result ||
            result.accepted !== true ||
            typeof result.providerReference !== "string" ||
            !result.providerReference.trim()
        ) {
            throw new TypeError(
                "Notification provider did not confirm delivery acceptance."
            );
        }
        return Object.freeze({ providerReference: result.providerReference });
    }

    return Object.freeze({ send });
}

function createUnconfiguredNotificationTransport() {
    return Object.freeze({
        send: async () => {
            throw new IntegrationUnavailableError("Notification delivery");
        }
    });
}

module.exports = {
    createNotificationTransport,
    createUnconfiguredNotificationTransport
};
