const { randomUUID } = require("node:crypto");

function isPositiveMinorUnits(value) {
    return typeof value === "number" &&
        Number.isSafeInteger(value) &&
        value > 0;
}

function validateJournalLine(line) {
    if (
        !line ||
        typeof line !== "object" ||
        typeof line.accountReference !== "string" ||
        !line.accountReference.trim() ||
        line.accountReference.length > 100
    ) {
        throw new TypeError("A valid accounting account reference is required.");
    }

    const hasDebit = line.debitMinorUnits !== undefined;
    const hasCredit = line.creditMinorUnits !== undefined;
    if (hasDebit === hasCredit) {
        throw new TypeError("Each journal line must contain one debit or credit.");
    }

    const amount = hasDebit
        ? line.debitMinorUnits
        : line.creditMinorUnits;
    if (!isPositiveMinorUnits(amount)) {
        throw new TypeError("Journal amounts must be positive integer minor units.");
    }

    return Object.freeze({
        accountReference: line.accountReference.trim(),
        debitMinorUnits: hasDebit ? amount : 0,
        creditMinorUnits: hasCredit ? amount : 0
    });
}

function sumSafe(values, label) {
    let total = 0;
    for (const value of values) {
        total += value;
        if (!Number.isSafeInteger(total)) {
            throw new RangeError(`${label} exceeds the safe integer range.`);
        }
    }
    return total;
}

function createBalancedJournalDraft({
    transactionReference,
    idempotencyKey,
    transactionType,
    currency,
    lines,
    createId = randomUUID
}) {
    if (
        typeof transactionReference !== "string" ||
        !transactionReference.trim() ||
        transactionReference.length > 150
    ) {
        throw new TypeError("A valid transaction reference is required.");
    }
    if (
        typeof idempotencyKey !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            .test(idempotencyKey)
    ) {
        throw new TypeError("A valid transaction idempotency key is required.");
    }
    if (
        typeof transactionType !== "string" ||
        !/^[A-Z][A-Z0-9_]{0,49}$/.test(transactionType)
    ) {
        throw new TypeError("A valid transaction type is required.");
    }
    if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)) {
        throw new TypeError("A valid ISO currency code is required.");
    }
    if (!Array.isArray(lines) || lines.length < 2) {
        throw new TypeError("At least two journal lines are required.");
    }
    if (typeof createId !== "function") {
        throw new TypeError("Journal identifier factory is required.");
    }

    const normalizedLines = Object.freeze(lines.map(validateJournalLine));
    const debits = sumSafe(
        normalizedLines.map((line) => line.debitMinorUnits),
        "Journal debit total"
    );
    const credits = sumSafe(
        normalizedLines.map((line) => line.creditMinorUnits),
        "Journal credit total"
    );
    if (debits === 0 || debits !== credits) {
        throw new TypeError("Journal debits and credits must balance.");
    }

    const journalId = createId();
    if (typeof journalId !== "string" || !journalId.trim()) {
        throw new TypeError("Journal identifier factory returned an invalid ID.");
    }
    return Object.freeze({
        journalId,
        transactionReference: transactionReference.trim(),
        idempotencyKey: idempotencyKey.toLowerCase(),
        transactionType,
        currency,
        status: "DRAFT",
        debitTotalMinorUnits: debits,
        creditTotalMinorUnits: credits,
        lines: normalizedLines
    });
}

module.exports = {
    createBalancedJournalDraft,
    isPositiveMinorUnits
};
