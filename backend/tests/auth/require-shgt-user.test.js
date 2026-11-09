
const test = require("node:test");
const assert = require("node:assert/strict");

const shgtUserService = require("../../src/services/shgt-user.service");

// Replace the database service with a controllable mock.
let mockLookup;

shgtUserService.findShgtUserByPrivyId = async (privyUserId) => {
    return mockLookup(privyUserId);
};

const requireShgtUser = require("../../src/middleware/requireShgtUser");

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

test("ACTIVE user is authorized", async () => {
    mockLookup = async () => ({
        userId: 21,
        accountStatus: "ACTIVE"
    });

    const req = { privyUserId: "did:privy:test123" };
    const res = createResponse();
    let nextCalled = false;

    await requireShgtUser(req, res, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.deepEqual(req.shgtUser, { userId: 21 });
});

test("Unregistered user is rejected", async () => {
    mockLookup = async () => null;

    const req = { privyUserId: "did:privy:unknown" };
    const res = createResponse();

    await requireShgtUser(req, res, () => {});

    assert.equal(res.statusCode, 404);
});

test("SUSPENDED user is rejected", async () => {
    mockLookup = async () => ({
        userId: 22,
        accountStatus: "SUSPENDED"
    });

    const req = { privyUserId: "did:privy:suspended" };
    const res = createResponse();

    await requireShgtUser(req, res, () => {});

    assert.equal(res.statusCode, 403);
});

test("CLOSED user is rejected", async () => {
    mockLookup = async () => ({
        userId: 23,
        accountStatus: "CLOSED"
    });

    const req = { privyUserId: "did:privy:closed" };
    const res = createResponse();

    await requireShgtUser(req, res, () => {});

    assert.equal(res.statusCode, 403);
});

test("Missing Privy identity is rejected", async () => {
    const req = {};
    const res = createResponse();

    await requireShgtUser(req, res, () => {});

    assert.equal(res.statusCode, 401);
});

test("Database/service failure returns 503", async () => {
    mockLookup = async () => {
        throw new Error("Simulated database failure");
    };

    const req = { privyUserId: "did:privy:test123" };
    const res = createResponse();

    await requireShgtUser(req, res, () => {});

    assert.equal(res.statusCode, 503);
});
