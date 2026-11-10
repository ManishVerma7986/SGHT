const test = require("node:test");
const assert = require("node:assert/strict");

const {
    createNotificationTransport,
    createUnconfiguredNotificationTransport
} = require("../../src/integrations/notifications/notification-transport");

test("notification delivery requires explicit provider acceptance", async () => {
    const transport = createNotificationTransport({
        provider: {
            send: async () => ({
                accepted: true,
                providerReference: "delivery-1"
            })
        }
    });
    assert.deepEqual(await transport.send({
        recipientReference: "user-1",
        channel: "EMAIL",
        templateId: "membership-approved"
    }), { providerReference: "delivery-1" });
});

test("unconfigured notification delivery never becomes a success", async () => {
    await assert.rejects(
        createUnconfiguredNotificationTransport().send({}),
        { name: "IntegrationUnavailableError" }
    );
});
