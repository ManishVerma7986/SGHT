const test = require("node:test");
const assert = require("node:assert/strict");

const {
    getDeploymentProfile,
    getOracleUsersTable
} = require("../../src/config/deployment-profile");
const {
    createShgtUserService
} = require("../../src/services/shgt-user.service");

const ORIGINAL_PROFILE = process.env.SHGT_DEPLOYMENT_PROFILE;

function setProfile(profile) {
    process.env.SHGT_DEPLOYMENT_PROFILE = profile;
}

test.after(() => {
    if (ORIGINAL_PROFILE === undefined) {
        delete process.env.SHGT_DEPLOYMENT_PROFILE;
    } else {
        process.env.SHGT_DEPLOYMENT_PROFILE = ORIGINAL_PROFILE;
    }
});

test("production profile selects the existing SHGT_APP.USERS table", () => {
    const env = { SHGT_DEPLOYMENT_PROFILE: "production" };

    assert.equal(getDeploymentProfile(env), "production");
    assert.equal(getOracleUsersTable(env), "SHGT_APP.USERS");
});

test("development profile selects only SHGT_DEV.USERS", async () => {
    setProfile("development");
    const calls = [];
    const service = createShgtUserService({
        getConnection: async () => ({
            async execute(statement, binds) {
                calls.push({ statement, binds });
                return { rows: [[123, "ACTIVE"]] };
            },
            async close() {}
        })
    });

    const user = await service.findShgtUserByPrivyId("did:privy:development");

    assert.equal(user.userId, 123);
    assert.equal(user.accountStatus, "ACTIVE");
    assert.match(calls[0].statement, /FROM SHGT_DEV\.USERS/);
    assert.doesNotMatch(calls[0].statement, /SHGT_APP/);
    assert.equal(
        calls[0].binds.privyUserId,
        "did:privy:development"
    );
});

test("invalid profile is rejected rather than falling back to production schema", async () => {
    setProfile("staging");
    const service = createShgtUserService({
        getConnection: async () => {
            assert.fail("Should not acquire a connection for an invalid profile.");
        }
    });

    assert.throws(
        () => getOracleUsersTable(),
        /SHGT_DEPLOYMENT_PROFILE must be production or development/
    );
    await assert.rejects(
        service.findShgtUserByPrivyId("did:privy:development"),
        /SHGT_DEPLOYMENT_PROFILE must be production or development/
    );
});

test("development service cannot query SHGT_APP.USERS", async () => {
    setProfile("development");
    const calls = [];
    const service = createShgtUserService({
        getConnection: async () => ({
            async execute(statement) {
                calls.push(statement);
                return { rows: [] };
            },
            async close() {}
        })
    });

    await service.findShgtUserByPrivyId("did:privy:unknown");

    assert.equal(calls.length, 1);
    assert.match(calls[0], /FROM SHGT_DEV\.USERS/);
    assert.doesNotMatch(calls[0], /SHGT_APP/);
});
