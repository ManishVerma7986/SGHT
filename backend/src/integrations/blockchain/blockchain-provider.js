const { IntegrationUnavailableError } = require("../integration-error");

function createBlockchainProvider({ provider } = {}) {
    if (
        !provider ||
        typeof provider.submitTransaction !== "function" ||
        typeof provider.getTransactionStatus !== "function" ||
        typeof provider.verifyEvent !== "function"
    ) {
        throw new TypeError("A blockchain provider adapter is required.");
    }

    async function submitTransaction(request) {
        if (
            !request ||
            typeof request !== "object" ||
            typeof request.idempotencyKey !== "string" ||
            !request.idempotencyKey.trim() ||
            typeof request.payload !== "object" ||
            request.payload === null ||
            Array.isArray(request.payload)
        ) {
            throw new TypeError("Blockchain submission request is invalid.");
        }
        const result = await provider.submitTransaction(request);
        if (
            !result ||
            !["SUBMITTED", "PENDING"].includes(result.status) ||
            typeof result.transactionHash !== "string" ||
            !/^0x[0-9a-f]+$/i.test(result.transactionHash)
        ) {
            throw new TypeError(
                "Blockchain provider returned an invalid submission response."
            );
        }
        return Object.freeze({
            status: result.status,
            transactionHash: result.transactionHash
        });
    }

    async function getTransactionStatus(transactionHash) {
        if (
            typeof transactionHash !== "string" ||
            !/^0x[0-9a-f]+$/i.test(transactionHash)
        ) {
            throw new TypeError("A valid blockchain transaction hash is required.");
        }
        const result = await provider.getTransactionStatus(transactionHash);
        if (
            !result ||
            !["PENDING", "CONFIRMED", "FAILED"].includes(result.status) ||
            !Number.isSafeInteger(result.confirmations) ||
            result.confirmations < 0
        ) {
            throw new TypeError(
                "Blockchain provider returned an invalid transaction status."
            );
        }
        return Object.freeze({
            status: result.status,
            confirmations: result.confirmations
        });
    }

    async function verifyEvent({
        transactionHash,
        eventName,
        expectedReference
    }) {
        if (
            typeof transactionHash !== "string" ||
            !/^0x[0-9a-f]+$/i.test(transactionHash) ||
            typeof eventName !== "string" ||
            !/^[A-Za-z][A-Za-z0-9_]{0,99}$/.test(eventName) ||
            typeof expectedReference !== "string" ||
            !expectedReference.trim()
        ) {
            throw new TypeError("Blockchain event verification request is invalid.");
        }
        const result = await provider.verifyEvent({
            transactionHash,
            eventName,
            expectedReference
        });
        if (
            !result ||
            result.verified !== true ||
            typeof result.eventReference !== "string" ||
            !result.eventReference.trim() ||
            !Number.isSafeInteger(result.blockNumber) ||
            result.blockNumber < 0 ||
            !Number.isSafeInteger(result.confirmations) ||
            result.confirmations < 0
        ) {
            throw new TypeError(
                "Blockchain provider did not return verifiable event evidence."
            );
        }
        return Object.freeze({
            verified: true,
            eventReference: result.eventReference,
            blockNumber: result.blockNumber,
            confirmations: result.confirmations
        });
    }

    return Object.freeze({
        submitTransaction,
        getTransactionStatus,
        verifyEvent
    });
}

function createUnconfiguredBlockchainProvider() {
    const unavailable = async () => {
        throw new IntegrationUnavailableError("Blockchain provider");
    };
    return Object.freeze({
        submitTransaction: unavailable,
        getTransactionStatus: unavailable,
        verifyEvent: unavailable
    });
}

module.exports = {
    createBlockchainProvider,
    createUnconfiguredBlockchainProvider
};
