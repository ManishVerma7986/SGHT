const test = require("node:test");
const assert = require("node:assert/strict");

const {
    GROUP_CREATION_REQUEST_FIELDS,
    GROUP_CREATION_REQUEST_COLUMNS,
    GROUP_WORKFLOW_REPOSITORY_METHODS,
    GROUP_WORKFLOW_PACKAGE_PROCEDURES,
    WORKFLOW_API_ERROR_CODES,
    decodePublicRequestId,
    encodePublicRequestId
} = require("../../src/domain/workflow-database-contract");
const {
    validateGroupRequest
} = require("../../src/domain/group-workflow");
const {
    createUnavailableGroupWorkflowRepository
} = require("../../src/repositories/group-workflow.repository");
const {
    createInMemoryGroupWorkflowRepository
} = require("../../src/repositories/test/in-memory-group-workflow.repository");

function withTestRepositoryEnabled(callback) {
    const previous = {
        NODE_ENV: process.env.NODE_ENV,
        SHGT_ENABLE_TEST_REPOSITORIES:
            process.env.SHGT_ENABLE_TEST_REPOSITORIES
    };
    process.env.NODE_ENV = "test";
    process.env.SHGT_ENABLE_TEST_REPOSITORIES = "1";
    try {
        return callback();
    } finally {
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
    }
}

test("group-creation DTO maps exactly to the proposed request columns", () => {
    assert.deepEqual(Object.keys(GROUP_CREATION_REQUEST_COLUMNS), [
        ...GROUP_CREATION_REQUEST_FIELDS
    ]);

    const result = validateGroupRequest({
        groupName: "Example Group",
        description: "Purpose",
        village: "Village",
        district: "District",
        state: "State",
        pinCode: "123456",
        contactDetails: "contact@example.test",
        proposedGroupSize: 10
    });
    assert.equal(result.error, undefined);
    assert.equal(result.value.pinCode, "123456");
    assert.equal(result.value.proposedGroupSize, 10);
    assert.match(GROUP_CREATION_REQUEST_COLUMNS.description, /^DESCRIPTION$/);
});

test("rejects request fields not represented by the proposed persistence contract", () => {
    assert.match(
        validateGroupRequest({ groupName: "Example Group", actorUserId: 99 }).error,
        /unsupported field/
    );
});

test("repository method contract matches both fail-closed and test-only adapters", () => {
    const unavailable = createUnavailableGroupWorkflowRepository();
    assert.deepEqual(Object.keys(unavailable).sort(),
        [...GROUP_WORKFLOW_REPOSITORY_METHODS].sort());

    const testRepository = withTestRepositoryEnabled(
        () => createInMemoryGroupWorkflowRepository()
    );
    assert.deepEqual(Object.keys(testRepository).sort(),
        [...GROUP_WORKFLOW_REPOSITORY_METHODS].sort());
    assert.ok(GROUP_WORKFLOW_PACKAGE_PROCEDURES.includes(
        "SUBMIT_GROUP_CREATION_REQUEST"
    ));
    assert.ok(GROUP_WORKFLOW_PACKAGE_PROCEDURES.includes("ACTIVATE_GROUP"));
    assert.ok(GROUP_WORKFLOW_PACKAGE_PROCEDURES.includes(
        "APPROVE_MEMBERSHIP_REQUEST"
    ));
});

test("public request IDs map exactly between 32 lowercase hex and RAW(16)", () => {
    const id = "00112233445566778899aabbccddeeff";
    const bytes = decodePublicRequestId(id);
    assert.equal(bytes.length, 16);
    assert.equal(encodePublicRequestId(bytes), id);
    assert.throws(() => decodePublicRequestId(`${id}00`), TypeError);
    assert.throws(() => decodePublicRequestId("x".repeat(32)), TypeError);
    assert.throws(() => encodePublicRequestId(Buffer.alloc(15)), TypeError);
});

test("workflow API error mapping exposes stable codes without Oracle text", () => {
    assert.equal(
        WORKFLOW_API_ERROR_CODES.IDEMPOTENCY_CONFLICT,
        "WORKFLOW_IDEMPOTENCY_CONFLICT"
    );
    assert.equal(WORKFLOW_API_ERROR_CODES.UNAVAILABLE, "WORKFLOW_UNAVAILABLE");
    assert.equal(
        WORKFLOW_API_ERROR_CODES.GROUP_CODE_CONFLICT,
        "WORKFLOW_GROUP_CODE_CONFLICT"
    );
    assert.equal(
        Object.values(WORKFLOW_API_ERROR_CODES).some((value) => /ORA-|200\d\d/.test(value)),
        false
    );
});
