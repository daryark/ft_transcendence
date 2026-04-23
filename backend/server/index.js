const http = require('http');
const { Server } = require('socket.io');

const app = require('../app');
const setupSockets = require('../sockets');
const { PORT } = require('../config/env');

const server = http.createServer(app);
const socketServer = new Server(server, {
    cors: { origin: '*',
            methods: ["GET", "POST"],
    }  //# todo - restrict origin in real env
});

setupSockets(socketServer);
// All routes here are under /api/... (matches nginx proxy_pass to this app)
const api = express.Router();
const { registerUser, loginUser} = require('../prisma/auth.ts');

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

api.post('/auth/register', async (req, res) => {
  try{
    const user = await registerUser(req.body);
    res.status(201).json({ message: 'User registered!', user });
  } catch (error) {
    res.status(400).json({ message: 'Failed to register user', error: error.message });
  }
});

api.post('/auth/login', async (req, res) => {
  try{
    const user = await loginUser(req.body);
    res.status(201).json({ message: 'User is logged in!', user });
  } catch (error) {
    res.status(400).json({ message: 'Failed to log in!', error: error.message });
  }
});

// GET /api/users/42  → param "id"
api.get('/users/:id', (req, res) => {
  res.json({ userId: req.params.id });
});

// all about server info is in 'server.about.txt' in the root of the 'backend' folder.