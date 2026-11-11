const { IntegrationUnavailableError } = require("../integration-error");
const { isPositiveMinorUnits } = require("../../domain/financial-ledger");

function requireInitiation(input) {
    if (
        !input ||
        typeof input !== "object" ||
        typeof input.transactionReference !== "string" ||
        !input.transactionReference.trim() ||
        !isPositiveMinorUnits(input.amountMinorUnits) ||
        typeof input.currency !== "string" ||
        !/^[A-Z]{3}$/.test(input.currency) ||
        typeof input.idempotencyKey !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            .test(input.idempotencyKey)
    ) {
        throw new TypeError("Payment initiation request is invalid.");
    }
}

function createPaymentGateway({ provider } = {}) {
    if (
        !provider ||
        typeof provider.initiatePayment !== "function" ||
        typeof provider.getPaymentStatus !== "function" ||
        typeof provider.verifyWebhook !== "function"
    ) {
        throw new TypeError("A payment provider adapter is required.");
    }

    async function initiatePayment(input) {
        requireInitiation(input);
        const result = await provider.initiatePayment(Object.freeze({
            transactionReference: input.transactionReference.trim(),
            amountMinorUnits: input.amountMinorUnits,
            currency: input.currency,
            idempotencyKey: input.idempotencyKey.toLowerCase()
        }));
        if (
            !result ||
            !["INITIATED", "PENDING"].includes(result.status) ||
            typeof result.providerReference !== "string" ||
            !result.providerReference.trim()
        ) {
            throw new TypeError(
                "Payment provider returned an invalid initiation response."
            );
        }
        return Object.freeze({
            status: result.status,
            providerReference: result.providerReference
        });
    }

    async function verifyWebhook({ rawBody, signature }) {
        if (
            !(Buffer.isBuffer(rawBody) || typeof rawBody === "string") ||
            !rawBody.length ||
            typeof signature !== "string" ||
            !signature.trim()
        ) {
            throw new TypeError("Signed payment webhook data is required.");
        }
        const result = await provider.verifyWebhook({ rawBody, signature });
        if (
            !result ||
            result.verified !== true ||
            typeof result.eventReference !== "string" ||
            !result.eventReference.trim() ||
            typeof result.paymentReference !== "string" ||
            !result.paymentReference.trim() ||
            !["SUCCEEDED", "FAILED", "REVERSED"].includes(result.outcome)
        ) {
            throw new TypeError(
                "Payment provider did not return verifiable webhook evidence."
            );
        }
        return Object.freeze({
            verified: true,
            eventReference: result.eventReference,
            paymentReference: result.paymentReference,
            outcome: result.outcome
        });
    }

    async function getPaymentStatus(providerReference) {
        if (
            typeof providerReference !== "string" ||
            !providerReference.trim() ||
            providerReference.length > 200
        ) {
            throw new TypeError("A valid payment provider reference is required.");
        }
        const result = await provider.getPaymentStatus(providerReference.trim());
        if (
            !result ||
            !["INITIATED", "PENDING", "SUCCEEDED", "FAILED", "REVERSED"]
                .includes(result.status) ||
            result.providerReference !== providerReference.trim()
        ) {
            throw new TypeError("Payment provider returned an invalid status response.");
        }
        return Object.freeze({
            status: result.status,
            providerReference: result.providerReference
        });
    }

    return Object.freeze({ initiatePayment, getPaymentStatus, verifyWebhook });
}

function createUnconfiguredPaymentGateway() {
    const unavailable = async () => {
        throw new IntegrationUnavailableError("Payment provider");
    };
    return Object.freeze({
        initiatePayment: unavailable,
        getPaymentStatus: unavailable,
        verifyWebhook: unavailable
    });
}

module.exports = {
    createPaymentGateway,
    createUnconfiguredPaymentGateway
};
