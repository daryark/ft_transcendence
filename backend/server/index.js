const http = require('http');
const { Server } = require('socket.io');

const app = require('../app');
const setupSockets = require('../sockets');
const { PORT } = require('../config/env');

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*',
            methods: ["GET", "POST"],
    }  //# todo - restrict origin in real env
});

setupSockets(io);

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

// all about server info is in 'server.about.txt' in the root of the 'backend' folder.