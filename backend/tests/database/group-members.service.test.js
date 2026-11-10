const test = require("node:test");
const assert = require("node:assert/strict");

const {
    createGroupMembersService
} = require("../../src/services/group-members.service");

const joinedDate = new Date("2025-03-10T00:00:00.000Z");

function row({
    membershipId = 101,
    userId = 42,
    profileUserId = userId,
    fullName = "Member Example",
    memberRole = "MEMBER",
    membershipStatus = "ACTIVE",
    date = joinedDate,
    duplicateFlag = 0,
    missingProfileFlag = 0
} = {}) {
    return [
        membershipId,
        userId,
        profileUserId,
        fullName,
        memberRole,
        membershipStatus,
        date,
        duplicateFlag,
        missingProfileFlag
    ];
}

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

    const service = createGroupMembersService({
        withAuthenticatedRead: async (userId, callback) => {
            calls.push({ operation: "withAuthenticatedRead", userId });
            return callback(connection);
        }
    });

    return { calls, ...service };
}

test("uses the authenticated read wrapper and binds authorized group pagination values", async () => {
    const harness = createHarness({ rows: [row()] });

    const result = await harness.findActiveGroupMembers(42, 23, {
        page: 3,
        limit: 10
    });

    assert.deepEqual(result, {
        members: [{
            fullName: "Member Example",
            memberRole: "MEMBER",
            membershipStatus: "ACTIVE",
            joinedDate
        }],
        pagination: {
            page: 3,
            limit: 10,
            hasMore: false
        }
    });
    assert.deepEqual(harness.calls[0], {
        operation: "withAuthenticatedRead",
        userId: 42
    });

    const { sql, binds } = harness.calls[1];
    assert.match(sql, /M\.GROUP_ID = :groupId/);
    assert.deepEqual(binds, {
        groupId: 23,
        offset: 20,
        fetchCount: 11,
        membershipStatus: "ACTIVE"
    });
    assert.doesNotMatch(sql, /(?:^|[^A-Z_])23(?:[^A-Z_]|$)/);
    assert.match(sql, /M\.MEMBERSHIP_STATUS = :membershipStatus/);
    assert.equal(binds.membershipStatus, "ACTIVE");
});

test("uses the required LEFT JOIN, ordering, and Oracle pagination", async () => {
    const harness = createHarness({ rows: [row()] });

    await harness.findActiveGroupMembers(42, 23, { page: 2, limit: 25 });

    const sql = harness.calls[1].sql;
    assert.match(
        sql,
        /LEFT JOIN SHGT_APP\.MEMBER_PROFILES P\s+ON P\.USER_ID = M\.USER_ID/
    );
    assert.doesNotMatch(sql, /INNER JOIN/i);
    assert.match(sql, /ORDER BY JOINED_DATE ASC NULLS LAST, MEMBERSHIP_ID ASC/);
    assert.match(sql, /OFFSET :offset ROWS\s+FETCH NEXT :fetchCount ROWS ONLY/);
    assert.deepEqual(harness.calls[1].binds, {
        groupId: 23,
        offset: 25,
        fetchCount: 26,
        membershipStatus: "ACTIVE"
    });
});

test("fetches limit plus one and reports hasMore without exposing internal identifiers", async () => {
    const harness = createHarness({
        rows: [
            row({ membershipId: 101, userId: 42, fullName: "First" }),
            row({ membershipId: 102, userId: 43, fullName: "Second" }),
            row({ membershipId: 103, userId: 44, fullName: "Third" })
        ]
    });

    const result = await harness.findActiveGroupMembers(42, 23, {
        page: 1,
        limit: 2
    });

    assert.equal(harness.calls[1].binds.fetchCount, 3);
    assert.deepEqual(result, {
        members: [
            {
                fullName: "First",
                memberRole: "MEMBER",
                membershipStatus: "ACTIVE",
                joinedDate
            },
            {
                fullName: "Second",
                memberRole: "MEMBER",
                membershipStatus: "ACTIVE",
                joinedDate
            }
        ],
        pagination: {
            page: 1,
            limit: 2,
            hasMore: true
        }
    });
});

test("fails closed when any active membership has no profile", async () => {
    const harness = createHarness({
        rows: [row({ profileUserId: null, missingProfileFlag: 1 })]
    });

    await assert.rejects(
        harness.findActiveGroupMembers(42, 23),
        { message: "Group member directory data integrity error." }
    );
});

test("fails closed when duplicate active memberships exist for a user", async () => {
    const harness = createHarness({
        rows: [row({ duplicateFlag: 1 })]
    });

    await assert.rejects(
        harness.findActiveGroupMembers(42, 23),
        { message: "Group member directory data integrity error." }
    );
});

test("rejects malformed rows and malformed sentinel rows", async () => {
    const malformedHarness = createHarness({
        rows: [[101, 42, 42, "Member Example"]]
    });
    await assert.rejects(
        malformedHarness.findActiveGroupMembers(42, 23),
        { message: "Group member directory data integrity error." }
    );

    const sentinelHarness = createHarness({
        rows: [[null, 42, null, null, null, null, null, 0, 0]]
    });
    await assert.rejects(
        sentinelHarness.findActiveGroupMembers(42, 23),
        { message: "Group member directory data integrity error." }
    );
});

test("accepts an empty page sentinel when no active members exist", async () => {
    const harness = createHarness({
        rows: [[null, null, null, null, null, null, null, 0, 0]]
    });

    assert.deepEqual(
        await harness.findActiveGroupMembers(42, 23),
        {
            members: [],
            pagination: {
                page: 1,
                limit: 25,
                hasMore: false
            }
        }
    );
});

test("detects integrity errors even when the requested page is empty", async () => {
    const harness = createHarness({
        rows: [[null, null, null, null, null, null, null, 1, 0]]
    });

    await assert.rejects(
        harness.findActiveGroupMembers(42, 23, { page: 10, limit: 25 }),
        { message: "Group member directory data integrity error." }
    );
});

test("uses a single SELECT and performs no DML or count query", async () => {
    const harness = createHarness({ rows: [row()] });

    await harness.findActiveGroupMembers(42, 23);

    assert.equal(
        harness.calls.filter((call) => call.operation === "execute").length,
        1
    );
    assert.match(harness.calls[1].sql, /^\s*WITH\b/i);
    assert.doesNotMatch(
        harness.calls[1].sql,
        /\b(?:INSERT|UPDATE|DELETE|MERGE|COUNT\s*\(\s*\*\s*\)\s+FROM)\b/i
    );
});

test("rejects invalid IDs and pagination before using the authenticated read", async () => {
    const harness = createHarness({ rows: [row()] });

    for (const [userId, groupId, options] of [
        [0, 23, {}],
        [42, 0, {}],
        [42, 23, { page: 0, limit: 25 }],
        [42, 23, { page: 1, limit: 0 }],
        [42, 23, { page: 1, limit: 101 }],
        [42, 23, { page: 1.5, limit: 25 }],
        [42, 23, { page: Number.MAX_SAFE_INTEGER, limit: 100 }]
    ]) {
        await assert.rejects(
            harness.findActiveGroupMembers(userId, groupId, options),
            TypeError
        );
    }

    assert.deepEqual(harness.calls, []);
});

test("propagates database errors from the authenticated read", async () => {
    const databaseError = new Error("Oracle internal details");
    const harness = createHarness({ error: databaseError });

    await assert.rejects(
        harness.findActiveGroupMembers(42, 23),
        (error) => error === databaseError
    );
});
