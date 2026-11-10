const test = require("node:test");
const assert = require("node:assert/strict");

const {
    createGroupMembershipService
} = require("../../src/services/group-membership.service");

function createServiceHarness({ rows, error } = {}) {
    const calls = [];
    const connection = {
        async execute(sql, binds) {
            calls.push({ sql, binds });

            if (error) {
                throw error;
            }

            return { rows };
        }
    };

    const service = createGroupMembershipService({
        withAuthenticatedRead: async (userId, callback) => {
            calls.push({ userId });
            return callback(connection);
        }
    });

    return {
        calls,
        ...service
    };
}

test("binds the authenticated user and requested group and returns an active membership", async () => {
    const harness = createServiceHarness({
        rows: [[105, 23, "TREASURER", "ACTIVE", "ACTIVE"]]
    });

    const membership = await harness.findActiveGroupMembership(42, 23);

    assert.deepEqual(membership, {
        membershipId: 105,
        groupId: 23,
        memberRole: "TREASURER",
        membershipStatus: "ACTIVE",
        groupStatus: "ACTIVE"
    });
    assert.deepEqual(harness.calls[0], { userId: 42 });
    assert.match(harness.calls[1].sql, /SHGT_APP\.SHG_MEMBERSHIPS/);
    assert.match(harness.calls[1].sql, /SHGT_APP\.SHG_GROUPS/);
    assert.match(harness.calls[1].sql, /M\.USER_ID = :userId/);
    assert.match(harness.calls[1].sql, /M\.GROUP_ID = :groupId/);
    assert.deepEqual(harness.calls[1].binds, {
        userId: 42,
        groupId: 23
    });
    assert.doesNotMatch(harness.calls[1].sql, /42|23/);
});

test("returns null when the membership is missing", async () => {
    const harness = createServiceHarness({ rows: [] });

    assert.equal(
        await harness.findActiveGroupMembership(42, 23),
        null
    );
});

test("rejects duplicate membership rows with a data-integrity error", async () => {
    const row = [105, 23, "MEMBER", "ACTIVE", "ACTIVE"];
    const harness = createServiceHarness({
        rows: [row, [...row]]
    });

    await assert.rejects(
        harness.findActiveGroupMembership(42, 23),
        {
            message: "Group membership data integrity error."
        }
    );
});

test("rejects a membership row that is not an array", async () => {
    const harness = createServiceHarness({
        rows: [{ membershipId: 105, groupId: 23 }]
    });

    await assert.rejects(
        harness.findActiveGroupMembership(42, 23),
        { message: "Group membership data integrity error." }
    );
});

test("rejects a membership row with fewer than five values", async () => {
    const harness = createServiceHarness({
        rows: [[105, 23, "MEMBER", "ACTIVE"]]
    });

    await assert.rejects(
        harness.findActiveGroupMembership(42, 23),
        { message: "Group membership data integrity error." }
    );
});

test("rejects a membership row with more than five values", async () => {
    const harness = createServiceHarness({
        rows: [[105, 23, "MEMBER", "ACTIVE", "ACTIVE", "unexpected"]]
    });

    await assert.rejects(
        harness.findActiveGroupMembership(42, 23),
        { message: "Group membership data integrity error." }
    );
});

test("returns null for an inactive membership", async () => {
    const harness = createServiceHarness({
        rows: [[105, 23, "MEMBER", "SUSPENDED", "ACTIVE"]]
    });

    assert.equal(
        await harness.findActiveGroupMembership(42, 23),
        null
    );
});

test("returns null for an inactive group", async () => {
    const harness = createServiceHarness({
        rows: [[105, 23, "MEMBER", "ACTIVE", "SUSPENDED"]]
    });

    assert.equal(
        await harness.findActiveGroupMembership(42, 23),
        null
    );
});

test("rejects invalid user IDs before using the authenticated read", async () => {
    const harness = createServiceHarness({ rows: [] });

    for (const userId of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "42"]) {
        await assert.rejects(
            harness.findActiveGroupMembership(userId, 23),
            /User ID must be a positive safe integer/
        );
    }

    assert.equal(harness.calls.length, 0);
});

test("rejects invalid group IDs before using the authenticated read", async () => {
    const harness = createServiceHarness({ rows: [] });

    for (const groupId of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "23"]) {
        await assert.rejects(
            harness.findActiveGroupMembership(42, groupId),
            /Group ID must be a positive safe integer/
        );
    }

    assert.equal(harness.calls.length, 0);
});

test("rejects an unsafe Oracle membership identifier", async () => {
    const harness = createServiceHarness({
        rows: [["9007199254740992", 23, "MEMBER", "ACTIVE", "ACTIVE"]]
    });

    await assert.rejects(
        harness.findActiveGroupMembership(42, 23),
        /Oracle returned an invalid membership ID/
    );
});

test("rejects an unsafe Oracle group identifier", async () => {
    const harness = createServiceHarness({
        rows: [[105, "9007199254740992", "MEMBER", "ACTIVE", "ACTIVE"]]
    });

    await assert.rejects(
        harness.findActiveGroupMembership(42, 23),
        /Oracle returned an invalid group ID/
    );
});

test("converts safe Oracle NUMBER strings to numeric identifiers", async () => {
    const harness = createServiceHarness({
        rows: [["105", "23", "MEMBER", "ACTIVE", "ACTIVE"]]
    });

    assert.deepEqual(
        await harness.findActiveGroupMembership(42, 23),
        {
            membershipId: 105,
            groupId: 23,
            memberRole: "MEMBER",
            membershipStatus: "ACTIVE",
            groupStatus: "ACTIVE"
        }
    );
});

test("propagates database errors from the authenticated read", async () => {
    const databaseError = new Error("Oracle query failed");
    const harness = createServiceHarness({ error: databaseError });

    await assert.rejects(
        harness.findActiveGroupMembership(42, 23),
        (error) => error === databaseError
    );
});

test("uses the injected authenticated-read lifecycle", async () => {
    const connection = {
        async execute() {
            return {
                rows: [[105, 23, "SECRETARY", "ACTIVE", "ACTIVE"]]
            };
        }
    };
    const calls = [];
    const harness = createGroupMembershipService({
        withAuthenticatedRead: async (userId, callback) => {
            calls.push(userId);
            return callback(connection);
        }
    });

    const membership = await harness.findActiveGroupMembership(42, 23);

    assert.deepEqual(calls, [42]);
    assert.equal(membership.memberRole, "SECRETARY");
});
