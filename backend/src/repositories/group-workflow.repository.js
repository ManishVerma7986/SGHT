class WorkflowPersistenceUnavailableError extends Error {
    constructor() {
        super("Group workflow persistence is not configured.");
        this.name = "WorkflowPersistenceUnavailableError";
    }
}

function createUnavailableGroupWorkflowRepository() {
    const unavailable = async () => {
        throw new WorkflowPersistenceUnavailableError();
    };

    return Object.freeze({
        createRequest: unavailable,
        findRequestsByUser: unavailable,
        findPendingRequests: unavailable,
        decideRequest: unavailable,
        activateGroup: unavailable,
        submitMembershipRequest: unavailable,
        findMembershipRequestsByUser: unavailable,
        findPendingMembershipRequests: unavailable,
        decideMembershipRequest: unavailable,
        withdrawMembershipRequest: unavailable
    });
}

module.exports = {
    WorkflowPersistenceUnavailableError,
    createUnavailableGroupWorkflowRepository
};
