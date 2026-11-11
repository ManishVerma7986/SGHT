const { createBalancedJournalDraft } = require("../domain/financial-ledger");
const {
    createUnavailableJournalRepository
} = require("../repositories/journal.repository");

function createJournalService({
    repository = createUnavailableJournalRepository(),
    createId
} = {}) {
    if (
        !repository ||
        typeof repository.findPostedJournal !== "function" ||
        typeof repository.postDraft !== "function" ||
        typeof repository.postReversal !== "function"
    ) {
        throw new TypeError("A journal repository is required.");
    }

    function createDraft(input) {
        return createBalancedJournalDraft({
            ...input,
            ...(createId ? { createId } : {})
        });
    }

    async function postDraft(draft) {
        return repository.postDraft(draft);
    }

    async function reversePostedJournal({ journalId, idempotencyKey }) {
        if (typeof journalId !== "string" || !journalId.trim()) {
            throw new TypeError("A valid posted journal ID is required.");
        }
        const original = await repository.findPostedJournal(journalId);
        if (!original) {
            return { notFound: true };
        }
        if (original.status !== "POSTED" || original.reversalOfJournalId) {
            return { conflict: true };
        }

        const draft = createBalancedJournalDraft({
            transactionReference: `REV-${original.journalId}`.slice(0, 150),
            idempotencyKey,
            transactionType: "REVERSAL",
            currency: original.currency,
            lines: original.lines.map((line) => line.debitMinorUnits > 0
                ? {
                    accountReference: line.accountReference,
                    creditMinorUnits: line.debitMinorUnits
                }
                : {
                    accountReference: line.accountReference,
                    debitMinorUnits: line.creditMinorUnits
                }),
            ...(createId ? { createId } : {})
        });
        return repository.postReversal(journalId, draft);
    }

    return Object.freeze({
        createDraft,
        postDraft,
        reversePostedJournal
    });
}

module.exports = { createJournalService };
