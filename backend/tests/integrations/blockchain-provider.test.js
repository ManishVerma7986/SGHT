const test = require("node:test");
const assert = require("node:assert/strict");

const {
    createBlockchainProvider,
    createUnconfiguredBlockchainProvider
} = require("../../src/integrations/blockchain/blockchain-provider");

test("blockchain submission remains pending until provider status confirms it", async () => {
    const provider = createBlockchainProvider({
        provider: {
            submitTransaction: async () => ({
                status: "SUBMITTED",
                transactionHash: "0xabc123"
            }),
            getTransactionStatus: async () => ({
                status: "PENDING",
                confirmations: 0
            }),
            verifyEvent: async () => ({
                verified: true,
                eventReference: "event-1",
                blockNumber: 8,
                confirmations: 2
            })
        }
    });
    assert.deepEqual(await provider.submitTransaction({
        idempotencyKey: "key-1",
        payload: { reference: "tx-1" }
    }), {
        status: "SUBMITTED",
        transactionHash: "0xabc123"
    });
    assert.deepEqual(await provider.getTransactionStatus("0xabc123"), {
        status: "PENDING",
        confirmations: 0
    });
});

test("provider confirmation count must be a nonnegative integer", async () => {
    const provider = createBlockchainProvider({
        provider: {
            submitTransaction: async () => ({
                status: "PENDING",
                transactionHash: "0xabc"
            }),
            getTransactionStatus: async () => ({
                status: "CONFIRMED",
                confirmations: -1
            }),
            verifyEvent: async () => ({})
        }
    });
    await assert.rejects(
        provider.getTransactionStatus("0xabc"),
        /invalid transaction status/
    );
});

test("blockchain events require provider-verified event evidence", async () => {
    const provider = createBlockchainProvider({
        provider: {
            submitTransaction: async () => ({
                status: "PENDING",
                transactionHash: "0xabc"
            }),
            getTransactionStatus: async () => ({
                status: "PENDING",
                confirmations: 0
            }),
            verifyEvent: async () => ({
                verified: true,
                eventReference: "event-1",
                blockNumber: 8,
                confirmations: 2
            })
        }
    });
    assert.deepEqual(await provider.verifyEvent({
        transactionHash: "0xabc",
        eventName: "SavingsContribution",
        expectedReference: "tx-1"
    }), {
        verified: true,
        eventReference: "event-1",
        blockNumber: 8,
        confirmations: 2
    });
});

test("unconfigured blockchain integration fails explicitly", async () => {
    await assert.rejects(
        createUnconfiguredBlockchainProvider().submitTransaction({
            idempotencyKey: "key",
            payload: {}
        }),
        { name: "IntegrationUnavailableError" }
    );
});
