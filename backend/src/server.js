const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
require("dotenv").config();

const app = express();

app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL
}));
app.use(express.json());
app.use(morgan("dev"));

app.get("/", (req, res) => {
    res.json({
        message: "Welcome to SHGT Backend API",
        status: "Running"
    });
});

app.get("/api/v1/health", (req, res) => {
    res.json({
        success: true,
        message: "SHGT API is healthy"
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`SHGT Backend running on http://localhost:${PORT}`);
});