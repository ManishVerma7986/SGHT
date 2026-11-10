const test = require("node:test");
const assert = require("node:assert/strict");

const {
    createRequireGroupMembership
} = require("../../src/middleware/requireGroupMembership");

function createResponse() {
    const response = {
        statusCode: null,
        body: null,

        status(code) {
            this.statusCode = code;
            return this;
        },

        json(data) {
            this.body = data;
            return this;
        }
    };

    return response;
}

function createHarness({
    membership = {
        membershipId: 105,
        groupId: 23,
        memberRole: "TREASURER"
    },
    error
} = {}) {
    const calls = [];
    const middleware = createRequireGroupMembership({
        findMembership: async (userId, groupId) => {
            calls.push({ userId, groupId });

            if (error) {
                throw error;
            }

            return membership;
        }
    });

    return {
        calls,
        middleware
    };
}

function createRequest(options = {}) {
    const userId = Object.hasOwn(options, "userId")
        ? options.userId
        : 42;
    const params = options.params || { groupId: "23" };
    const query = options.query || {};
    const body = options.body || {};

    return {
        shgtUser: userId === undefined ? undefined : { userId },
        params,
        query,
        body
    };
}

async function runMiddleware(middleware, req) {
    const res = createResponse();
    let nextCalls = 0;

    await middleware(req, res, () => {
        nextCalls += 1;
    });

    return { res, nextCalls };
}

test("authorizes active membership and calls next exactly once", async () => {
    const harness = createHarness();
    const req = createRequest();
    const { res, nextCalls } = await runMiddleware(harness.middleware, req);

    assert.equal(res.statusCode, null);
    assert.equal(nextCalls, 1);
    assert.deepEqual(harness.calls, [{ userId: 42, groupId: 23 }]);
    assert.deepEqual(req.groupMembership, {
        membershipId: 105,
        groupId: 23,
        memberRole: "TREASURER"
    });
});

test("rejects missing SHGT identity without looking up membership", async () => {
    const harness = createHarness();
    const req = createRequest({ userId: undefined });
    const { res, nextCalls } = await runMiddleware(harness.middleware, req);

    assert.equal(res.statusCode, 401);
    assert.equal(nextCalls, 0);
    assert.deepEqual(harness.calls, []);
});

test("rejects invalid SHGT identity values", async () => {
    for (const userId of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "42"]) {
        const harness = createHarness();
        const req = createRequest({ userId });
        const { res, nextCalls } = await runMiddleware(
            harness.middleware,
            req
        );

        assert.equal(res.statusCode, 401);
        assert.equal(nextCalls, 0);
        assert.deepEqual(harness.calls, []);
    }
});

test("rejects a missing group ID", async () => {
    const harness = createHarness();
    const req = createRequest({ params: {} });
    const { res, nextCalls } = await runMiddleware(harness.middleware, req);

    assert.equal(res.statusCode, 400);
    assert.equal(nextCalls, 0);
    assert.deepEqual(harness.calls, []);
});

test("rejects malformed, zero, negative and unsafe group IDs", async () => {
    for (const groupId of [
        "abc",
        "1.5",
        "1e2",
        "",
        "0",
        "-1",
        "9007199254740992"
    ]) {
        const harness = createHarness();
        const req = createRequest({ params: { groupId } });
        const { res, nextCalls } = await runMiddleware(
            harness.middleware,
            req
        );

        assert.equal(res.statusCode, 400, `groupId=${groupId}`);
        assert.equal(nextCalls, 0, `groupId=${groupId}`);
        assert.deepEqual(harness.calls, [], `groupId=${groupId}`);
    }
});

test("rejects nonmembers", async () => {
    const harness = createHarness({ membership: null });
    const req = createRequest();
    const { res, nextCalls } = await runMiddleware(harness.middleware, req);

    assert.equal(res.statusCode, 404);
    assert.equal(nextCalls, 0);
});

test("returns 404 when the service returns null for an inactive membership", async () => {
    // The membership service tests verify that inactive database rows return null.
    const harness = createHarness({ membership: null });
    const req = createRequest();
    const { res, nextCalls } = await runMiddleware(harness.middleware, req);

    assert.equal(res.statusCode, 404);
    assert.equal(nextCalls, 0);
});

test("returns 404 when the service returns null for an inactive group", async () => {
    // The membership service tests verify that inactive groups return null.
    const harness = createHarness({ membership: null });
    const req = createRequest();
    const { res, nextCalls } = await runMiddleware(harness.middleware, req);

    assert.equal(res.statusCode, 404);
    assert.equal(nextCalls, 0);
});

test("fails closed when the service returns a mismatched group ID", async () => {
    const harness = createHarness({
        membership: {
            membershipId: 105,
            groupId: 24,
            memberRole: "MEMBER"
        }
    });
    const req = createRequest();
    const { res, nextCalls } = await runMiddleware(harness.middleware, req);

    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, {
        success: false,
        message: "Internal authorization error."
    });
    assert.equal(nextCalls, 0);
    assert.equal(req.groupMembership, undefined);
});

test("fails closed when the service returns an invalid membership ID", async () => {
    for (const membershipId of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "105"]) {
        const harness = createHarness({
            membership: {
                membershipId,
                groupId: 23,
                memberRole: "MEMBER"
            }
        });
        const req = createRequest();
        const { res, nextCalls } = await runMiddleware(
            harness.middleware,
            req
        );

        assert.equal(res.statusCode, 500);
        assert.equal(res.body.message, "Internal authorization error.");
        assert.equal(nextCalls, 0);
        assert.equal(req.groupMembership, undefined);
    }
});

test("fails closed when the service returns an invalid role", async () => {
    for (const memberRole of ["ADMIN", "member", "", null]) {
        const harness = createHarness({
            membership: {
                membershipId: 105,
                groupId: 23,
                memberRole
            }
        });
        const req = createRequest();
        const { res, nextCalls } = await runMiddleware(
            harness.middleware,
            req
        );

        assert.equal(res.statusCode, 500);
        assert.equal(res.body.message, "Internal authorization error.");
        assert.equal(nextCalls, 0);
        assert.equal(req.groupMembership, undefined);
    }
});

test("fails closed when the service returns malformed membership data", async () => {
    for (const membership of [
        {},
        [],
        "membership",
        { membershipId: 105, groupId: 23 },
        { membershipId: 105, memberRole: "MEMBER" }
    ]) {
        const harness = createHarness({ membership });
        const req = createRequest();
        const { res, nextCalls } = await runMiddleware(
            harness.middleware,
            req
        );

        assert.equal(res.statusCode, 500);
        assert.equal(res.body.message, "Internal authorization error.");
        assert.equal(nextCalls, 0);
        assert.equal(req.groupMembership, undefined);
    }
});

test("returns 503 when the membership service fails", async () => {
    const harness = createHarness({
        error: new Error("database unavailable")
    });
    const req = createRequest();
    const { res, nextCalls } = await runMiddleware(harness.middleware, req);

    assert.equal(res.statusCode, 503);
    assert.equal(nextCalls, 0);
    assert.equal(
        res.body.message,
        "Unable to verify group membership. Please try again."
    );
});

test("logs safely when the membership service throws a value without a message", async () => {
    const middleware = createRequireGroupMembership({
        findMembership: async () => {
            throw {
                get message() {
                    throw new Error("unprintable thrown value");
                },
                toString() {
                    throw new Error("unprintable thrown value");
                }
            };
        }
    });
    const originalConsoleError = console.error;
    const loggedArguments = [];
    console.error = (...args) => {
        loggedArguments.push(args);
    };

    try {
        const req = createRequest();
        const { res, nextCalls } = await runMiddleware(middleware, req);

        assert.equal(res.statusCode, 503);
        assert.equal(nextCalls, 0);
        assert.deepEqual(loggedArguments, [[
            "Group membership authorization failed:",
            "Unknown error"
        ]]);
    } finally {
        console.error = originalConsoleError;
    }
});

test("uses the authenticated SHGT user ID, not body or query IDs", async () => {
    const harness = createHarness();
    const req = createRequest({
        userId: 42,
        params: { groupId: "23" },
        query: {
            groupId: "77",
            userId: "999",
            memberRole: "PRESIDENT"
        },
        body: {
            groupId: 88,
            userId: 1000,
            memberRole: "SECRETARY"
        }
    });

    const { nextCalls } = await runMiddleware(harness.middleware, req);

    assert.equal(nextCalls, 1);
    assert.deepEqual(harness.calls, [{ userId: 42, groupId: 23 }]);
});

test("ignores frontend-supplied roles and populates role from the service result", async () => {
    const harness = createHarness({
        membership: {
            membershipId: 105,
            groupId: 23,
            memberRole: "MEMBER"
        }
    });
    const req = createRequest({
        body: { memberRole: "PRESIDENT", userId: 999 }
    });

    const { nextCalls } = await runMiddleware(harness.middleware, req);

    assert.equal(nextCalls, 1);
    assert.deepEqual(req.groupMembership, {
        membershipId: 105,
        groupId: 23,
        memberRole: "MEMBER"
    });
});
