
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
require("dotenv").config();

const authRoutes = require("./routes/auth.routes");

const {
    initializePool,
    getConnection,
    closePool
} = require("./config/database");

const app = express();

app.use(helmet());

app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173"
}));

app.use(express.json());
app.use(morgan("dev"));

app.use("/api/v1/auth", authRoutes);

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

        const result = await connection.execute(
            "SELECT USER FROM DUAL"
        );

        res.json({
            success: true,
            message: "Oracle Database connected",
            databaseUser: result.rows[0][0]
        });
    } catch (error) {
        console.error("Database health check failed:", error.message);

        res.status(503).json({
            success: false,
            message: "Database connection unavailable"
        });
    } finally {
        if (connection) {
            await connection.close();
        }
    }
});

const PORT = process.env.PORT || 5000;

let server;

async function startServer() {
    // Database must be ready before the API starts.
    await initializePool();

    server = app.listen(PORT, () => {
        console.log(`SHGT Backend running on http://localhost:${PORT}`);
    });
}

async function shutdown(signal) {
    console.log(`\n${signal} received. Shutting down SHGT...`);

    if (server) {
        server.close(async () => {
            try {
                await closePool();
                console.log("SHGT shutdown completed.");
                process.exit(0);
            } catch (error) {
                console.error("Shutdown error:", error.message);
                process.exit(1);
            }
        });
    } else {
        await closePool();
        process.exit(0);
    }
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

startServer().catch(async (error) => {
    console.error("SHGT startup failed:", error.message);

    try {
        await closePool();
    } catch (closeError) {
        console.error("Pool cleanup failed:", closeError.message);
    }

    process.exit(1);
});
