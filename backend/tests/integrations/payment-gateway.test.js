const test = require("node:test");
const assert = require("node:assert/strict");

const {
    createPaymentGateway,
    createUnconfiguredPaymentGateway
} = require("../../src/integrations/payments/payment-gateway");

const initiation = {
    transactionReference: "tx-1",
    amountMinorUnits: 100,
    currency: "INR",
    idempotencyKey: "2eb80bc1-45c8-4f20-a888-7757a8819975"
};

function createTestProvider(overrides = {}) {
    return {
        initiatePayment: async () => ({
            status: "PENDING",
            providerReference: "order-1"
        }),
        getPaymentStatus: async () => ({
            status: "PENDING",
            providerReference: "order-1"
        }),
        verifyWebhook: async () => ({
            verified: true,
            eventReference: "event-1",
            paymentReference: "payment-1",
            outcome: "SUCCEEDED"
        }),
        ...overrides
    };
}

test("payment initiation accepts pending evidence but never initiation-as-success", async () => {
    const gateway = createPaymentGateway({ provider: createTestProvider() });
    assert.deepEqual(await gateway.initiatePayment(initiation), {
        status: "PENDING",
        providerReference: "order-1"
    });

    await assert.rejects(
        createPaymentGateway({
            provider: createTestProvider({
                initiatePayment: async () => ({
                    status: "SUCCESS",
                    providerReference: "order-2"
                })
            })
        }).initiatePayment(initiation),
        /invalid initiation response/
    );
});

test("payment status is accepted only from a matching provider reference", async () => {
    const gateway = createPaymentGateway({
        provider: createTestProvider({
            getPaymentStatus: async () => ({
                status: "SUCCEEDED",
                providerReference: "order-1"
            })
        })
    });
    assert.deepEqual(await gateway.getPaymentStatus("order-1"), {
        status: "SUCCEEDED",
        providerReference: "order-1"
    });

    await assert.rejects(
        createPaymentGateway({
            provider: createTestProvider({
                getPaymentStatus: async () => ({
                    status: "SUCCEEDED",
                    providerReference: "different-order"
                })
            })
        }).getPaymentStatus("order-1"),
        /invalid status response/
    );
});

test("payment webhook results require independently verified provider evidence", async () => {
    const gateway = createPaymentGateway({
        provider: createTestProvider({
            verifyWebhook: async () => ({
                verified: false,
                eventReference: "event-1",
                paymentReference: "payment-1",
                outcome: "SUCCEEDED"
            })
        })
    });
    await assert.rejects(
        gateway.verifyWebhook({ rawBody: "payload", signature: "signature" }),
        /verifiable webhook evidence/
    );
});

test("unconfigured payment integration fails explicitly", async () => {
    await assert.rejects(
        createUnconfiguredPaymentGateway().initiatePayment(initiation),
        { name: "IntegrationUnavailableError" }
    );
    await assert.rejects(
        createUnconfiguredPaymentGateway().getPaymentStatus("order-1"),
        { name: "IntegrationUnavailableError" }
    );
});
