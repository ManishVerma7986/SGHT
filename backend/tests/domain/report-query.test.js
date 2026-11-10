const test = require("node:test");
const assert = require("node:assert/strict");

const {
    validateReportQuery
} = require("../../src/domain/report-query");

test("normalizes bounded report filters and pagination", () => {
    assert.deepEqual(
        validateReportQuery("transactions", {
            from: "2026-01-01",
            to: "2026-02-01",
            groupId: "12",
            memberId: 7,
            page: "3",
            limit: "20"
        }),
        {
            reportType: "transactions",
            from: "2026-01-01",
            to: "2026-02-01",
            groupId: 12,
            memberId: 7,
            transactionType: undefined,
            page: 3,
            limit: 20,
            offset: 40
        }
    );
});

test("rejects malformed, reversed, unsupported, or excessive report queries", () => {
    const invalid = [
        ["unknown", {}],
        ["transactions", { from: "2026-02-30" }],
        ["transactions", { from: "2026-03-01", to: "2026-02-01" }],
        ["transactions", { limit: 101 }],
        ["transactions", { page: 1000000 }],
        ["transactions", { groupId: 0 }]
    ];
    for (const [type, filters] of invalid) {
        assert.throws(() => validateReportQuery(type, filters), TypeError);
    }
});
