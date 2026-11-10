const test = require("node:test");
const assert = require("node:assert/strict");

const {
    createBalancedJournalDraft
} = require("../../src/domain/financial-ledger");

const balancedInput = {
    transactionReference: "transaction-1",
    idempotencyKey: "2eb80bc1-45c8-4f20-a888-7757a8819975",
    transactionType: "SAVINGS_CONTRIBUTION",
    currency: "INR",
    lines: [
        { accountReference: "cash", debitMinorUnits: 1250 },
        { accountReference: "member-savings", creditMinorUnits: 1250 }
    ],
    createId: () => "journal-1"
};

test("creates a balanced draft using integer minor units and never posts it", () => {
    const draft = createBalancedJournalDraft(balancedInput);
    assert.equal(draft.status, "DRAFT");
    assert.equal(draft.debitTotalMinorUnits, 1250);
    assert.equal(draft.creditTotalMinorUnits, 1250);
    assert.equal(draft.journalId, "journal-1");
    assert.equal(draft.idempotencyKey, balancedInput.idempotencyKey);
    assert.ok(Object.isFrozen(draft));
    assert.ok(Object.isFrozen(draft.lines));
});

test("rejects unbalanced, fractional, unsafe, and malformed journal lines", () => {
    for (const lines of [
        [
            { accountReference: "cash", debitMinorUnits: 100 },
            { accountReference: "savings", creditMinorUnits: 99 }
        ],
        [
            { accountReference: "cash", debitMinorUnits: 1.5 },
            { accountReference: "savings", creditMinorUnits: 1.5 }
        ],
        [
            { accountReference: "cash", debitMinorUnits: 100, creditMinorUnits: 100 },
            { accountReference: "savings", creditMinorUnits: 100 }
        ]
    ]) {
        assert.throws(
            () => createBalancedJournalDraft({ ...balancedInput, lines }),
            TypeError
        );
    }
});

test("rejects totals outside the safe integer range", () => {
    assert.throws(
        () => createBalancedJournalDraft({
            ...balancedInput,
            lines: [
                { accountReference: "cash", debitMinorUnits: Number.MAX_SAFE_INTEGER },
                { accountReference: "a", creditMinorUnits: Number.MAX_SAFE_INTEGER },
                { accountReference: "b", creditMinorUnits: 1 }
            ]
        }),
        RangeError
    );
});

test("rejects insufficient identity or currency fields", () => {
    assert.throws(
        () => createBalancedJournalDraft({
            ...balancedInput,
            transactionReference: " "
        }),
        TypeError
    );
    assert.throws(
        () => createBalancedJournalDraft({ ...balancedInput, currency: "INR " }),
        TypeError
    );
    assert.throws(
        () => createBalancedJournalDraft({
            ...balancedInput,
            idempotencyKey: "invalid"
        }),
        TypeError
    );
});
