const test = require("node:test");
const assert = require("node:assert/strict");

const {
    createInMemoryJournalRepository
} = require("../../src/repositories/test/in-memory-journal.repository");
const {
    createUnavailableJournalRepository,
    JournalPersistenceUnavailableError
} = require("../../src/repositories/journal.repository");
const {
    createJournalService
} = require("../../src/services/journal.service");

const firstKey = "2eb80bc1-45c8-4f20-a888-7757a8819975";
const secondKey = "3eb80bc1-45c8-4f20-a888-7757a8819976";

function withTestRepository(options, callback) {
    const previous = {
        NODE_ENV: process.env.NODE_ENV,
        SHGT_ENABLE_TEST_REPOSITORIES: process.env.SHGT_ENABLE_TEST_REPOSITORIES
    };
    process.env.NODE_ENV = "test";
    process.env.SHGT_ENABLE_TEST_REPOSITORIES = "1";
    try {
        return callback(createInMemoryJournalRepository(options));
    } finally {
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
}

function journalInput(overrides = {}) {
    return {
        transactionReference: "contribution-001",
        idempotencyKey: firstKey,
        transactionType: "SAVINGS_CONTRIBUTION",
        currency: "INR",
        lines: [
            { accountReference: "cash", debitMinorUnits: 1200 },
            { accountReference: "member-savings", creditMinorUnits: 1200 }
        ],
        ...overrides
    };
}

test("posted journals are immutable and contain balanced integer-minor-unit lines", async () => {
    await withTestRepository({}, async (repository) => {
        const service = createJournalService({ repository, createId: () => "journal-1" });
        const draft = service.createDraft(journalInput());
        const result = await service.postDraft(draft);

        assert.equal(result.replayed, false);
        assert.equal(result.journal.status, "POSTED");
        assert.equal(result.journal.debitTotalMinorUnits, 1200);
        assert.equal(result.journal.creditTotalMinorUnits, 1200);
        assert.ok(Object.isFrozen(result.journal));
        assert.ok(Object.isFrozen(result.journal.lines));
        assert.ok(result.journal.lines.every(Object.isFrozen));
        assert.equal(await repository.findPostedJournal("journal-1"), result.journal);
    });
});

test("posting idempotency replays identical content and conflicts on changed content", async () => {
    await withTestRepository({}, async (repository) => {
        let sequence = 0;
        const service = createJournalService({
            repository,
            createId: () => `journal-${++sequence}`
        });
        const first = await service.postDraft(service.createDraft(journalInput()));
        const replay = await service.postDraft(service.createDraft(journalInput()));
        const conflict = await service.postDraft(service.createDraft(journalInput({
            lines: [
                { accountReference: "cash", debitMinorUnits: 1300 },
                { accountReference: "member-savings", creditMinorUnits: 1300 }
            ]
        })));

        assert.equal(replay.replayed, true);
        assert.equal(replay.journal.journalId, first.journal.journalId);
        assert.deepEqual(conflict, { conflict: true });
    });
});

test("failed journal commit leaves no partial record or idempotency reservation", async () => {
    let fail = true;
    await withTestRepository({
        beforeCommit: () => {
            if (fail) throw new Error("Injected pre-commit failure.");
        }
    }, async (repository) => {
        const service = createJournalService({ repository, createId: () => "journal-failure" });
        const draft = service.createDraft(journalInput());

        await assert.rejects(service.postDraft(draft), /Injected pre-commit failure/);
        assert.equal(await repository.findPostedJournal(draft.journalId), null);

        fail = false;
        const result = await service.postDraft(draft);
        assert.equal(result.replayed, false);
        assert.equal(result.journal.status, "POSTED");
    });
});

test("reversal posts a new balanced entry and never edits the original", async () => {
    await withTestRepository({}, async (repository) => {
        let sequence = 0;
        const service = createJournalService({
            repository,
            createId: () => `journal-${++sequence}`
        });
        const posted = await service.postDraft(service.createDraft(journalInput()));
        const originalBefore = posted.journal;

        const reversal = await service.reversePostedJournal({
            journalId: originalBefore.journalId,
            idempotencyKey: secondKey
        });
        assert.equal(reversal.journal.status, "POSTED");
        assert.equal(reversal.journal.transactionType, "REVERSAL");
        assert.equal(reversal.journal.reversalOfJournalId, originalBefore.journalId);
        assert.equal(reversal.journal.reversalOfReference, originalBefore.transactionReference);
        assert.deepEqual(reversal.journal.lines, [
            { accountReference: "cash", debitMinorUnits: 0, creditMinorUnits: 1200 },
            { accountReference: "member-savings", debitMinorUnits: 1200, creditMinorUnits: 0 }
        ]);
        assert.equal(await repository.findPostedJournal(originalBefore.journalId), originalBefore);

        const retry = await service.reversePostedJournal({
            journalId: originalBefore.journalId,
            idempotencyKey: secondKey
        });
        assert.equal(retry.replayed, true);
        assert.equal(retry.journal.journalId, reversal.journal.journalId);
    });
});

test("reversal rejects missing, already-reversed, and reversal journals", async () => {
    await withTestRepository({}, async (repository) => {
        let sequence = 0;
        const service = createJournalService({
            repository,
            createId: () => `journal-${++sequence}`
        });
        assert.deepEqual(await service.reversePostedJournal({
            journalId: "missing",
            idempotencyKey: firstKey
        }), { notFound: true });

        const original = await service.postDraft(service.createDraft(journalInput()));
        const reversal = await service.reversePostedJournal({
            journalId: original.journal.journalId,
            idempotencyKey: secondKey
        });
        assert.deepEqual(await service.reversePostedJournal({
            journalId: reversal.journal.journalId,
            idempotencyKey: "4eb80bc1-45c8-4f20-a888-7757a8819977"
        }), { conflict: true });
        assert.deepEqual(await service.reversePostedJournal({
            journalId: original.journal.journalId,
            idempotencyKey: "5eb80bc1-45c8-4f20-a888-7757a8819978"
        }), { conflict: true });
    });
});

test("unavailable production journal repository fails closed", async () => {
    const service = createJournalService({
        repository: createUnavailableJournalRepository()
    });
    const draft = service.createDraft(journalInput());
    await assert.rejects(service.postDraft(draft), JournalPersistenceUnavailableError);
});

test("in-memory journal repository requires explicit test opt-in", () => {
    const previous = {
        NODE_ENV: process.env.NODE_ENV,
        SHGT_ENABLE_TEST_REPOSITORIES: process.env.SHGT_ENABLE_TEST_REPOSITORIES
    };
    delete process.env.NODE_ENV;
    delete process.env.SHGT_ENABLE_TEST_REPOSITORIES;
    try {
        assert.throws(
            () => createInMemoryJournalRepository(),
            /explicit test-repository opt-in/
        );
    } finally {
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
});
