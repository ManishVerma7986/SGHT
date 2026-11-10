function normalizeRecords(records, sourceName) {
    if (!Array.isArray(records)) {
        throw new TypeError(`${sourceName} records must be an array.`);
    }

    const byReference = new Map();
    for (const record of records) {
        if (
            !record ||
            typeof record !== "object" ||
            typeof record.reference !== "string" ||
            !record.reference.trim() ||
            !Number.isSafeInteger(record.amountMinorUnits) ||
            record.amountMinorUnits <= 0 ||
            typeof record.currency !== "string" ||
            !/^[A-Z]{3}$/.test(record.currency)
        ) {
            throw new TypeError(`${sourceName} record is invalid.`);
        }
        const reference = record.reference.trim();
        if (byReference.has(reference)) {
            throw new TypeError(`${sourceName} contains duplicate references.`);
        }
        byReference.set(reference, Object.freeze({
            reference,
            amountMinorUnits: record.amountMinorUnits,
            currency: record.currency
        }));
    }
    return byReference;
}

function reconcileReferences({ externalRecords, ledgerRecords }) {
    const external = normalizeRecords(externalRecords, "External");
    const ledger = normalizeRecords(ledgerRecords, "Ledger");
    const references = [...new Set([...external.keys(), ...ledger.keys()])]
        .sort();

    return Object.freeze(references.map((reference) => {
        const externalRecord = external.get(reference) ?? null;
        const ledgerRecord = ledger.get(reference) ?? null;
        let status;
        if (!externalRecord) {
            status = "MISSING_EXTERNAL";
        } else if (!ledgerRecord) {
            status = "MISSING_LEDGER";
        } else if (
            externalRecord.amountMinorUnits !== ledgerRecord.amountMinorUnits ||
            externalRecord.currency !== ledgerRecord.currency
        ) {
            status = "MISMATCH";
        } else {
            status = "MATCHED";
        }
        return Object.freeze({
            reference,
            status,
            externalRecord,
            ledgerRecord
        });
    }));
}

module.exports = { reconcileReferences };
