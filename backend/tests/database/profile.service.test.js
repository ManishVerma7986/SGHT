const test = require("node:test");
const assert = require("node:assert/strict");

const {
    PROFILE_INTEGRITY_ERROR,
    createProfileService
} = require("../../src/services/profile.service");

test("reads only the authenticated member's known profile field", async () => {
    const calls = [];
    const service = createProfileService({
        withAuthenticatedRead: async (userId, callback) => {
            calls.push({ userId });
            return callback({
                execute: async (sql, binds) => {
                    calls.push({ sql, binds });
                    return { rows: [[1, "Example Member"]] };
                }
            });
        }
    });

    assert.deepEqual(await service.findOwnProfile(27), {
        fullName: "Example Member"
    });
    assert.equal(calls[0].userId, 27);
    assert.deepEqual(calls[1].binds, { userId: 27 });
    assert.match(calls[1].sql, /FROM SHGT_APP\.MEMBER_PROFILES/);
    assert.match(calls[1].sql, /WHERE USER_ID = :userId/);
});

test("returns null for a missing profile", async () => {
    const service = createProfileService({
        withAuthenticatedRead: async (_userId, callback) =>
            callback({ execute: async () => ({ rows: [[0, null]] }) })
    });

    assert.equal(await service.findOwnProfile(27), null);
});

test("rejects malformed or duplicate profile rows", async () => {
    for (const rows of [[[2, "Example Member"]], [[1, " "]], []]) {
        const service = createProfileService({
            withAuthenticatedRead: async (_userId, callback) =>
                callback({ execute: async () => ({ rows }) })
        });
        await assert.rejects(
            service.findOwnProfile(27),
            { code: PROFILE_INTEGRITY_ERROR }
        );
    }
});

test("rejects an invalid authenticated user identifier before reading", async () => {
    let read = false;
    const service = createProfileService({
        withAuthenticatedRead: async () => {
            read = true;
        }
    });

    await assert.rejects(service.findOwnProfile(0), TypeError);
    assert.equal(read, false);
});
