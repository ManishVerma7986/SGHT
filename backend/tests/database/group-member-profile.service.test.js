const test = require("node:test");
const assert = require("node:assert/strict");

const {
    createGroupMemberProfileService,
    INTEGRITY_ERROR_CODE
} = require("../../src/services/group-member-profile.service");

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

    const service = createGroupMemberProfileService({
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

test("retrieves only the authenticated user's profile with active authorization", async () => {
    const harness = createHarness({
        rows: [[1, 1, 1, "Member Example"]]
    });

    const result = await harness.findOwnGroupProfile(42, 23);

    assert.deepEqual(result, {
        authorized: true,
        profile: {
            fullName: "Member Example"
        }
    });
    assert.deepEqual(harness.calls[0], {
        operation: "withAuthenticatedRead",
        userId: 42
    });

    const { sql, binds } = harness.calls[1];
    assert.match(sql, /FROM SHGT_APP\.MEMBER_PROFILES P/);
    assert.match(sql, /P\.USER_ID = :userId/);
    assert.match(sql, /M\.USER_ID = :userId/);
    assert.match(sql, /M\.GROUP_ID = :groupId/);
    assert.match(sql, /M\.MEMBERSHIP_STATUS = :activeMembershipStatus/);
    assert.match(sql, /G\.GROUP_STATUS = :activeGroupStatus/);
    assert.deepEqual(binds, {
        userId: 42,
        groupId: 23,
        activeMembershipStatus: "ACTIVE",
        activeGroupStatus: "ACTIVE"
    });
    assert.doesNotMatch(sql, /(?:^|[^A-Z_])(?:42|23)(?:[^A-Z_]|$)/);
    assert.match(sql, /^\s*WITH\b/i);
    assert.doesNotMatch(
        sql,
        /\b(?:INSERT|UPDATE|DELETE|MERGE)\b/i
    );
    assert.doesNotMatch(
        sql,
        /\b(?:PHONE_NUMBER|EMAIL|DATE_OF_BIRTH|ADDRESS|VILLAGE|DISTRICT|STATE|PIN_CODE|PROFILE_ID)\b/i
    );
    assert.equal(
        Object.hasOwn(result.profile, "userId") ||
            Object.hasOwn(result.profile, "profileId"),
        false
    );
});

test("distinguishes a missing profile from invalid authorization context", async () => {
    const missingProfile = createHarness({
        rows: [[1, 1, 0, null]]
    });
    assert.deepEqual(
        await missingProfile.findOwnGroupProfile(42, 23),
        {
            authorized: true,
            profile: null
        }
    );

    const inactiveMembership = createHarness({
        rows: [[0, 1, 1, "Member Example"]]
    });
    assert.deepEqual(
        await inactiveMembership.findOwnGroupProfile(42, 23),
        {
            authorized: false,
            profile: null
        }
    );

    const inactiveGroup = createHarness({
        rows: [[1, 0, 1, "Member Example"]]
    });
    assert.deepEqual(
        await inactiveGroup.findOwnGroupProfile(42, 23),
        {
            authorized: false,
            profile: null
        }
    );
});

test("rejects duplicate profiles and duplicate active memberships", async () => {
    for (const rows of [
        [[1, 1, 2, "Member Example"]],
        [[2, 1, 1, "Member Example"]]
    ]) {
        const harness = createHarness({ rows });

        await assert.rejects(
            harness.findOwnGroupProfile(42, 23),
            (error) => error.code === INTEGRITY_ERROR_CODE
        );
    }
});

test("rejects malformed rows, counts, and profile values", async () => {
    const malformedResults = [
        undefined,
        [],
        [[1, 1, 1]],
        [[-1, 1, 1, "Member Example"]],
        [[1, "invalid", 1, "Member Example"]],
        [[1, 1, 1, null]],
        [[1, 1, 1, "   "]]
    ];

    for (const rows of malformedResults) {
        const harness = createHarness({ rows });

        await assert.rejects(
            harness.findOwnGroupProfile(42, 23),
            (error) => error.code === INTEGRITY_ERROR_CODE
        );
    }
});

test("rejects invalid IDs before entering the authenticated read", async () => {
    const harness = createHarness({ rows: [[1, 1, 1, "Member Example"]] });

    for (const [userId, groupId] of [
        [0, 23],
        [42, 0],
        [-1, 23],
        [42, Number.MAX_SAFE_INTEGER + 1]
    ]) {
        await assert.rejects(
            harness.findOwnGroupProfile(userId, groupId),
            TypeError
        );
    }

    assert.deepEqual(harness.calls, []);
});

test("propagates database failures from the authenticated read", async () => {
    const databaseError = new Error("Oracle internal details");
    const harness = createHarness({ error: databaseError });

    await assert.rejects(
        harness.findOwnGroupProfile(42, 23),
        (error) => error === databaseError
    );
});
