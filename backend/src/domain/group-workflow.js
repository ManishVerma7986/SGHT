const GROUP_REQUEST_STATUSES = Object.freeze([
    "PENDING",
    "APPROVED",
    "REJECTED",
    "WITHDRAWN"
]);

const GROUP_STATUSES = Object.freeze([
    "DRAFT",
    "ACTIVE",
    "SUSPENDED",
    "CLOSED"
]);

function normalizeText(value, maxLength) {
    if (typeof value !== "string") {
        return null;
    }

    const normalized = value.trim();
    if (
        normalized.length > maxLength ||
        /[\u0000-\u001F\u007F]/.test(normalized)
    ) {
        return null;
    }

    return normalized || null;
}

function validateGroupRequest(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        return { error: "Group request details are required." };
    }
    const allowedFields = new Set([
        "groupName",
        "description",
        "village",
        "district",
        "state",
        "pinCode",
        "contactDetails",
        "proposedGroupSize"
    ]);
    if (Object.keys(input).some((field) => !allowedFields.has(field))) {
        return { error: "Group request contains an unsupported field." };
    }

    const groupName = normalizeText(input.groupName, 150);
    const description = normalizeText(input.description ?? "", 500);
    const village = normalizeText(input.village ?? "", 100);
    const district = normalizeText(input.district ?? "", 100);
    const state = normalizeText(input.state ?? "", 100);
    const contactDetails = normalizeText(input.contactDetails ?? "", 254);
    const pinCode = normalizeText(input.pinCode ?? "", 10);
    const groupSize = input.proposedGroupSize;

    if (!groupName || groupName.length < 2) {
        return { error: "Enter a valid group name." };
    }
    if (
        input.description !== undefined &&
        input.description !== "" &&
        !description
    ) {
        return { error: "Enter a valid group description." };
    }
    if (input.village && !village) {
        return { error: "Enter a valid village." };
    }
    if (input.district && !district) {
        return { error: "Enter a valid district." };
    }
    if (input.state && !state) {
        return { error: "Enter a valid state." };
    }
    if (input.contactDetails && !contactDetails) {
        return { error: "Enter valid contact details." };
    }
    if (input.pinCode && !pinCode) {
        return { error: "Enter a valid PIN code." };
    }
    if (
        groupSize !== undefined &&
        groupSize !== null &&
        (!Number.isSafeInteger(groupSize) || groupSize <= 0)
    ) {
        return { error: "Proposed group size must be a positive whole number." };
    }

    return {
        value: Object.freeze({
            groupName,
            description,
            village,
            district,
            state,
            pinCode,
            contactDetails,
            proposedGroupSize: groupSize ?? null
        })
    };
}

function normalizeRejectionReason(value) {
    return normalizeText(value, 500);
}

module.exports = {
    GROUP_REQUEST_STATUSES,
    GROUP_STATUSES,
    normalizeRejectionReason,
    validateGroupRequest
};
