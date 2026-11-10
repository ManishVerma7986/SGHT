
const test = require("node:test");
const assert = require("node:assert/strict");

const requirePrivyAuth = require("../../src/middleware/requirePrivyAuth");

function createResponse() {
    return {
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
}

function createRequest(authorization) {
    return {
        headers: {
            authorization
        }
    };
}

test("Rejects requests without a Bearer token", async () => {
    const middleware = requirePrivyAuth.createRequirePrivyAuth({
        verifyToken: async () => {
            throw new Error("Should not execute");
        }
    });

    const req = createRequest(undefined);
    const res = createResponse();

    await middleware(req, res, () => {
        assert.fail("next() should not execute");
    });

    assert.equal(res.statusCode, 401);
});

test("Rejects empty Bearer tokens", async () => {
    const middleware = requirePrivyAuth.createRequirePrivyAuth({
        verifyToken: async () => ({ user_id: "test-user" })
    });

    const req = createRequest("Bearer   ");
    const res = createResponse();

    await middleware(req, res, () => {
        assert.fail("next() should not execute");
    });

    assert.equal(res.statusCode, 401);
});

test("Rejects invalid Privy tokens", async () => {
    const middleware = requirePrivyAuth.createRequirePrivyAuth({
        verifyToken: async () => {
            const error = new Error("Invalid token");
            error.name = "InvalidAuthTokenError";
            throw error;
        }
    });

    const req = createRequest("Bearer invalid-token");
    const res = createResponse();

    await middleware(req, res, () => {
        assert.fail("next() should not execute");
    });

    assert.equal(res.statusCode, 401);
});

test("Returns 503 when the verification service fails", async () => {
    const middleware = requirePrivyAuth.createRequirePrivyAuth({
        verifyToken: async () => {
            throw new Error("Service unavailable");
        }
    });

    const req = createRequest("Bearer test-token");
    const res = createResponse();

    await middleware(req, res, () => {
        assert.fail("next() should not execute");
    });

    assert.equal(res.statusCode, 503);
});

test("Rejects claims without a valid user_id", async () => {
    const middleware = requirePrivyAuth.createRequirePrivyAuth({
        verifyToken: async () => ({
            user_id: "   "
        })
    });

    const req = createRequest("Bearer test-token");
    const res = createResponse();

    await middleware(req, res, () => {
        assert.fail("next() should not execute");
    });

    assert.equal(res.statusCode, 401);
});

test("Accepts valid claims and attaches Privy identity", async () => {
    const middleware = requirePrivyAuth.createRequirePrivyAuth({
        verifyToken: async (token) => {
            assert.equal(token, "valid-token");

            return {
                user_id: "did:privy:test-user-123"
            };
        }
    });

    const req = createRequest("Bearer valid-token");
    const res = createResponse();

    let nextCalled = false;

    await middleware(req, res, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(req.privyUserId, "did:privy:test-user-123");
});
