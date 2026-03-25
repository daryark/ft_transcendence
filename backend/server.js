const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { PORT } = require('./config/env');

const registerSocketHandlers = require('./socket');

const app = express();
// require('dotenv').config();
const cors = require('cors');

/**
 * Middleware = functions that run BEFORE request handlers
 */
app.use(cors());
/**
 * Parses JSON body in HTTP requests
 * Needed for POST /login, /matchmaking, etc.
 */
app.use(express.json());//??!

/**
 * Simple health check endpoint
 * Used to verify server is alive
 */
app.get('/health', (req, res) => res.json({ status: 'ok' }));

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*',
            methods: ["GET", "POST"],
    }  //! todo - restrict origin in real env
});

registerSocketHandlers(io);

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});





