
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

require("dotenv").config();

const authRoutes = require("./routes/auth.routes");
const groupsRoutes = require("./routes/groups.routes");

const {
    initializePool,
    getConnection,
    closePool
} = require("./config/database");
const {
    createServerLifecycle
} = require("./services/server-lifecycle.service");

const app = express();

app.use(helmet());

app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173"
}));

app.use(express.json({ limit: "32kb" }));
app.use(morgan("dev"));

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/groups", groupsRoutes);

// Basic API health check
app.get("/", (req, res) => {
    res.json({
        message: "Welcome to SHGT Backend API",
        status: "Running"
    });
});

// Application health check
app.get("/api/v1/health", (req, res) => {
    res.json({
        success: true,
        message: "SHGT API is healthy"
    });
});

// Oracle database health check
app.get("/api/v1/health/database", async (req, res) => {
    let connection;

    try {
        connection = await getConnection();

        await connection.execute("SELECT 1 FROM DUAL");

        res.json({
            success: true,
            message: "Oracle Database connected"
        });
    } catch (error) {
        console.error(
            "Database health check failed:",
            error.message
        );

        if (!res.headersSent) {
            res.status(503).json({
                success: false,
                message: "Database connection unavailable"
            });
        }
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (error) {
                console.error(
                    "Health-check connection cleanup failed:",
                    error.message
                );
            }
        }
    }
});

app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        message: "API endpoint not found."
    });
});

app.use((error, req, res, next) => {
    if (res.headersSent) {
        return next(error);
    }

    const statusCode =
        Number.isInteger(error.status) &&
        error.status >= 400 &&
        error.status < 500
            ? error.status
            : 500;

    if (statusCode >= 500) {
        console.error("Unhandled API error:", error.message);
    }

    const message = statusCode === 413
        ? "Request body is too large."
        : statusCode === 400
            ? "Invalid request body."
            : "Internal server error.";

    return res.status(statusCode).json({
        success: false,
        message
    });
});

const PORT = process.env.PORT || 5000;
const SHUTDOWN_TIMEOUT_MS = 30_000;

function createLifecycle() {
    return createServerLifecycle({
        app,
        initializePool,
        closePool,
        port: PORT,
        shutdownTimeoutMs: SHUTDOWN_TIMEOUT_MS
    });
}

if (require.main === module) {
    const lifecycle = createLifecycle();

    for (const signal of ["SIGINT", "SIGTERM"]) {
        process.once(signal, () => {
            lifecycle.shutdown(signal).then((exitCode) => {
                process.exitCode = exitCode;
            });
        });
    }

    lifecycle.start().catch(() => {
        lifecycle.shutdown("STARTUP_FAILURE").then((exitCode) => {
            process.exitCode = exitCode || 1;
        });
    });
}

module.exports = {
    app,
    createLifecycle
};
