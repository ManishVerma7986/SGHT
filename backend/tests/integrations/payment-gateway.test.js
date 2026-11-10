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

test("payment initiation accepts pending evidence but never initiation-as-success", async () => {
    const gateway = createPaymentGateway({
        provider: {
            initiatePayment: async () => ({
                status: "PENDING",
                providerReference: "order-1"
            }),
            verifyWebhook: async () => ({
                verified: true,
                eventReference: "event-1",
                paymentReference: "payment-1",
                outcome: "SUCCEEDED"
            })
        }
    });
    assert.deepEqual(await gateway.initiatePayment(initiation), {
        status: "PENDING",
        providerReference: "order-1"
    });
    await assert.rejects(
        createPaymentGateway({
            provider: {
                initiatePayment: async () => ({
                    status: "SUCCESS",
                    providerReference: "order-2"
                }),
                verifyWebhook: async () => ({})
            }
        }).initiatePayment(initiation),
        /invalid initiation response/
    );
});

test("payment webhook results require independently verified provider evidence", async () => {
    const gateway = createPaymentGateway({
        provider: {
            initiatePayment: async () => ({
                status: "INITIATED",
                providerReference: "order-1"
            }),
            verifyWebhook: async () => ({
                verified: false,
                eventReference: "event-1",
                paymentReference: "payment-1",
                outcome: "SUCCEEDED"
            })
        }
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
});
