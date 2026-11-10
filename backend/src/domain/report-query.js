const REPORT_TYPES = new Set([
    "group-savings",
    "member-savings",
    "contributions",
    "loan-portfolio",
    "outstanding-loans",
    "repayments",
    "overdue-repayments",
    "transactions",
    "group-activity"
]);

const MAX_LIMIT = 100;
const MAX_OFFSET = 100000;

function parseDate(value, field) {
    if (value === undefined) {
        return undefined;
    }
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new TypeError(`${field} must be a valid YYYY-MM-DD date.`);
    }
    const parsedDate = new Date(`${value}T00:00:00.000Z`);
    if (
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate.toISOString().slice(0, 10) !== value
    ) {
        throw new TypeError(`${field} must be a valid YYYY-MM-DD date.`);
    }
    return value;
}

function positiveInteger(value, fallback, field) {
    if (value === undefined) {
        return fallback;
    }
    if (
        typeof value !== "number" &&
        (typeof value !== "string" || !/^\d+$/.test(value))
    ) {
        throw new TypeError(`${field} must be a positive safe integer.`);
    }
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        throw new TypeError(`${field} must be a positive safe integer.`);
    }
    return parsed;
}

function validateReportQuery(reportType, input = {}) {
    if (!REPORT_TYPES.has(reportType)) {
        throw new TypeError("Unsupported report type.");
    }
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new TypeError("Report filters must be an object.");
    }
    const allowedFilters = new Set([
        "from",
        "to",
        "groupId",
        "memberId",
        "transactionType",
        "page",
        "limit"
    ]);
    if (Object.keys(input).some((key) => !allowedFilters.has(key))) {
        throw new TypeError("Report filter is not supported.");
    }
    if (
        input.transactionType !== undefined &&
        (typeof input.transactionType !== "string" ||
            !/^[A-Z][A-Z0-9_]{0,49}$/.test(input.transactionType))
    ) {
        throw new TypeError("transactionType filter is invalid.");
    }

    const from = parseDate(input.from, "from");
    const to = parseDate(input.to, "to");
    if (from && to && from > to) {
        throw new TypeError("from must not be after to.");
    }
    const page = positiveInteger(input.page, 1, "page");
    const limit = positiveInteger(input.limit, 25, "limit");
    const offset = (page - 1) * limit;
    if (
        limit > MAX_LIMIT ||
        !Number.isSafeInteger(offset) ||
        offset > MAX_OFFSET
    ) {
        throw new TypeError("Report pagination exceeds the permitted range.");
    }

    const groupId = input.groupId === undefined
        ? undefined
        : positiveInteger(input.groupId, undefined, "groupId");
    const memberId = input.memberId === undefined
        ? undefined
        : positiveInteger(input.memberId, undefined, "memberId");

    return Object.freeze({
        reportType,
        from,
        to,
        groupId,
        memberId,
        transactionType: input.transactionType,
        page,
        limit,
        offset
    });
}

module.exports = {
    REPORT_TYPES,
    validateReportQuery
};
