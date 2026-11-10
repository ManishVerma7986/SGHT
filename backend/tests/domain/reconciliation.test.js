const test = require("node:test");
const assert = require("node:assert/strict");

const {
    reconcileReferences
} = require("../../src/domain/reconciliation");

test("classifies matches, differences, and missing records without mutating sources", () => {
    const externalRecords = [
        { reference: "a", amountMinorUnits: 100, currency: "INR" },
        { reference: "b", amountMinorUnits: 200, currency: "INR" },
        { reference: "c", amountMinorUnits: 300, currency: "INR" }
    ];
    const ledgerRecords = [
        { reference: "a", amountMinorUnits: 100, currency: "INR" },
        { reference: "b", amountMinorUnits: 201, currency: "INR" },
        { reference: "d", amountMinorUnits: 400, currency: "INR" }
    ];

    assert.deepEqual(
        reconcileReferences({ externalRecords, ledgerRecords }).map(
            ({ reference, status }) => [reference, status]
        ),
        [
            ["a", "MATCHED"],
            ["b", "MISMATCH"],
            ["c", "MISSING_LEDGER"],
            ["d", "MISSING_EXTERNAL"]
        ]
    );
    assert.equal(externalRecords.length, 3);
    assert.equal(ledgerRecords.length, 3);
});

test("rejects duplicate or invalid reconciliation references", () => {
    const duplicate = [
        { reference: "same", amountMinorUnits: 1, currency: "INR" },
        { reference: "same", amountMinorUnits: 1, currency: "INR" }
    ];
    assert.throws(
        () => reconcileReferences({
            externalRecords: duplicate,
            ledgerRecords: []
        }),
        /duplicate references/
    );
    assert.throws(
        () => reconcileReferences({
            externalRecords: [{ reference: "bad", amountMinorUnits: 0, currency: "INR" }],
            ledgerRecords: []
        }),
        /record is invalid/
    );
});
