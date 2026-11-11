class JournalPersistenceUnavailableError extends Error {
    constructor() {
        super("Journal persistence is not configured.");
        this.name = "JournalPersistenceUnavailableError";
    }
}

function createUnavailableJournalRepository() {
    const unavailable = async () => {
        throw new JournalPersistenceUnavailableError();
    };

    return Object.freeze({
        findPostedJournal: unavailable,
        postDraft: unavailable,
        postReversal: unavailable
    });
}

module.exports = {
    JournalPersistenceUnavailableError,
    createUnavailableJournalRepository
};
