const test = require("node:test");
const assert = require("node:assert/strict");

const {
    createGroupOverviewService
} = require("../../src/services/group-overview.service");

const formationDate = new Date("2024-06-15T00:00:00.000Z");
const row = [
    23,
    "GRP-023",
    "Hillview Group",
    "Hillview",
    "North District",
    "Example State",
    formationDate,
    "ACTIVE"
];

function createHarness({ rows, error } = {}) {
    const calls = [];
    const connection = {
        async execute(sql, binds) {
            calls.push({ operation: "execute", sql, binds });

            if (error) {
                throw error;
            }

            return { rows };
        }
    };

    const service = createGroupOverviewService({
        withAuthenticatedRead: async (userId, callback) => {
            calls.push({ operation: "withAuthenticatedRead", userId });
            return callback(connection);
        }
    });

    return {
        calls,
        ...service
    };
}

test("maps the eight approved group fields from the authenticated read", async () => {
    const harness = createHarness({ rows: [row] });

    const overview = await harness.findGroupOverview(42, 23);

    assert.deepEqual(overview, {
        groupId: 23,
        groupCode: "GRP-023",
        groupName: "Hillview Group",
        village: "Hillview",
        district: "North District",
        state: "Example State",
        formationDate,
        groupStatus: "ACTIVE"
    });
    assert.deepEqual(harness.calls[0], {
        operation: "withAuthenticatedRead",
        userId: 42
    });
    assert.match(harness.calls[1].sql, /FROM SHGT_APP\.SHG_GROUPS/);
    assert.match(harness.calls[1].sql, /WHERE GROUP_ID = :groupId/);
    assert.deepEqual(harness.calls[1].binds, { groupId: 23 });
    assert.doesNotMatch(harness.calls[1].sql, /(?:^|[^A-Z_])23(?:[^A-Z_]|$)/);
    assert.match(harness.calls[1].sql, /^\s*SELECT\b/i);
    assert.doesNotMatch(
        harness.calls[1].sql,
        /\b(?:INSERT|UPDATE|DELETE|MERGE|COMMIT|ROLLBACK)\b/i
    );
    assert.doesNotMatch(
        harness.calls[1].sql,
        /\b(?:PIN_CODE|CREATED_AT|UPDATED_AT)\b/i
    );
    assert.equal(harness.calls[1].operation, "execute");
    assert.equal(harness.calls.filter((call) => call.operation === "execute").length, 1);
});

test("returns null when the group does not exist", async () => {
    const harness = createHarness({ rows: [] });

    assert.equal(await harness.findGroupOverview(42, 23), null);
});

test("rejects duplicate rows and malformed rows", async () => {
    const duplicateHarness = createHarness({ rows: [row, [...row]] });
    await assert.rejects(
        duplicateHarness.findGroupOverview(42, 23),
        { message: "Group overview data integrity error." }
    );

    const malformedHarness = createHarness({
        rows: [[23, "GRP-023", "Hillview Group"]]
    });
    await assert.rejects(
        malformedHarness.findGroupOverview(42, 23),
        { message: "Group overview data integrity error." }
    );
});

test("rejects returned group IDs that differ from the requested group", async () => {
    const harness = createHarness({
        rows: [[24, ...row.slice(1)]]
    });

    await assert.rejects(
        harness.findGroupOverview(42, 23),
        { message: "Group overview data integrity error." }
    );
});

test("rejects invalid IDs before entering the authenticated read", async () => {
    const harness = createHarness({ rows: [row] });

    for (const [userId, groupId] of [
        [0, 23],
        [42, 0],
        [-1, 23],
        [42, Number.MAX_SAFE_INTEGER + 1]
    ]) {
        await assert.rejects(
            harness.findGroupOverview(userId, groupId),
            TypeError
        );
    }

    assert.deepEqual(harness.calls, []);
});

test("propagates database errors from the authenticated read", async () => {
    const databaseError = new Error("Oracle internal details");
    const harness = createHarness({ error: databaseError });

    await assert.rejects(
        harness.findGroupOverview(42, 23),
        (error) => error === databaseError
    );
});

test("uses the injected authenticated read-only context", async () => {
    const calls = [];
    const service = createGroupOverviewService({
        withAuthenticatedRead: async (userId, callback) => {
            calls.push(userId);
            return callback({
                async execute(sql, binds) {
                    calls.push({ sql, binds });
                    return { rows: [row] };
                }
            });
        }
    });

    const overview = await service.findGroupOverview(42, 23);

    assert.equal(overview.groupId, 23);
    assert.equal(calls[0], 42);
    assert.match(calls[1].sql, /^SELECT/);
    assert.deepEqual(calls[1].binds, { groupId: 23 });
});
