import express from "express";
import cors from "cors";
import http from "http";
import WebSocket, { WebSocketServer } from 'ws';
import dotenv from "dotenv";

import apiRouter from "./routes/api.js";
import { startHourlyUpdate } from "./cron/hourlyUpdate.js";
import { seedMainChannels, seedAdmin } from "./services/seed.js";

dotenv.config();

// Seed initial main channels (background)
seedAdmin();
seedMainChannels();



// for testing commit
const app = express();
app.use(cors());
app.use(express.json());


// Routes
app.use("/api", apiRouter);

import { initWebSocket } from "./services/websocket.service.js";
// Set up server
const server = http.createServer(app);

// WebSocket
initWebSocket(server);

// Start Cron
startHourlyUpdate();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});