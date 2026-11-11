const { isDeepStrictEqual } = require("node:util");
const { createBalancedJournalDraft } = require("../../domain/financial-ledger");

function requireTestOnlyMode() {
    if (
        process.env.NODE_ENV !== "test" ||
        process.env.SHGT_ENABLE_TEST_REPOSITORIES !== "1"
    ) {
        throw new Error(
            "In-memory repositories require NODE_ENV=test and explicit test-repository opt-in."
        );
    }
}

function validateDraft(draft) {
    if (!draft || typeof draft !== "object" || draft.status !== "DRAFT") {
        throw new TypeError("Only a journal draft can be posted.");
    }
    if (!Array.isArray(draft.lines)) {
        throw new TypeError("Journal draft lines are required.");
    }

    const reconstructed = createBalancedJournalDraft({
        transactionReference: draft.transactionReference,
        idempotencyKey: draft.idempotencyKey,
        transactionType: draft.transactionType,
        currency: draft.currency,
        createId: () => draft.journalId,
        lines: draft.lines.map((line) => {
            if (line.debitMinorUnits > 0 && line.creditMinorUnits === 0) {
                return {
                    accountReference: line.accountReference,
                    debitMinorUnits: line.debitMinorUnits
                };
            }
            if (line.creditMinorUnits > 0 && line.debitMinorUnits === 0) {
                return {
                    accountReference: line.accountReference,
                    creditMinorUnits: line.creditMinorUnits
                };
            }
            throw new TypeError("Journal draft line is invalid.");
        })
    });
    if (!isDeepStrictEqual(reconstructed, draft)) {
        throw new TypeError("Journal draft does not match the validated ledger contract.");
    }
}

function freezeJournal(journal, now) {
    const postedAt = now();
    if (!(postedAt instanceof Date) || Number.isNaN(postedAt.getTime())) {
        throw new TypeError("Journal posting timestamp is invalid.");
    }
    return Object.freeze({
        ...journal,
        status: "POSTED",
        postedAt: postedAt.toISOString(),
        lines: Object.freeze(journal.lines.map((line) => Object.freeze({ ...line })))
    });
}

function operationFingerprint(draft, reversalOfJournalId = null) {
    return JSON.stringify({
        transactionReference: draft.transactionReference,
        idempotencyKey: draft.idempotencyKey,
        transactionType: draft.transactionType,
        currency: draft.currency,
        debitTotalMinorUnits: draft.debitTotalMinorUnits,
        creditTotalMinorUnits: draft.creditTotalMinorUnits,
        lines: draft.lines,
        reversalOfJournalId
    });
}

function createInMemoryJournalRepository({
    now = () => new Date(),
    beforeCommit = () => {}
} = {}) {
    requireTestOnlyMode();
    if (typeof now !== "function" || typeof beforeCommit !== "function") {
        throw new TypeError("Journal test repository callbacks must be functions.");
    }

    const journals = new Map();
    const idempotency = new Map();
    const reversals = new Map();

    async function commit(draft, reversalOfJournalId = null) {
        validateDraft(draft);
        const fingerprint = operationFingerprint(draft, reversalOfJournalId);
        const previous = idempotency.get(draft.idempotencyKey);
        if (previous) {
            return previous.fingerprint === fingerprint
                ? { journal: previous.journal, replayed: true }
                : { conflict: true };
        }

        if (journals.has(draft.journalId)) {
            return { conflict: true };
        }

        let original;
        if (reversalOfJournalId !== null) {
            original = journals.get(reversalOfJournalId);
            if (!original) {
                return { notFound: true };
            }
            if (
                original.status !== "POSTED" ||
                original.reversalOfJournalId ||
                reversals.has(reversalOfJournalId)
            ) {
                return { conflict: true };
            }
        }

        beforeCommit(Object.freeze({
            draft,
            reversalOfJournalId
        }));
        const journal = freezeJournal({
            ...draft,
            reversalOfJournalId,
            reversalOfReference: original?.transactionReference ?? null
        }, now);

        journals.set(journal.journalId, journal);
        idempotency.set(draft.idempotencyKey, { fingerprint, journal });
        if (reversalOfJournalId !== null) {
            reversals.set(reversalOfJournalId, journal.journalId);
        }
        return { journal, replayed: false };
    }

    return Object.freeze({
        async findPostedJournal(journalId) {
            return journals.get(journalId) ?? null;
        },
        async postDraft(draft) {
            return commit(draft);
        },
        async postReversal(journalId, draft) {
            return commit(draft, journalId);
        }
    });
}

module.exports = {
    createInMemoryJournalRepository
};
