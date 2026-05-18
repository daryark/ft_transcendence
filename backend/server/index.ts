import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server as IOServer } from 'socket.io';
import socketSetup from '../sockets';
import PORT from '../config/env';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new IOServer(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    }, // todo - restrict origin in real env
});

socketSetup(io);

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

// all about server info is in 'server.about.txt' in the root of the 'backend' folder.