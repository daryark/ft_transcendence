import express from 'express';
import cors from 'cors';
import { authenticateToken } from './middleware/httpAuth';
import type { Request, Response } from 'express';


const app = express();
module.exports = app;

app.use(cors()); //#2
app.use(express.json());

export type ApiRequest = Request & { user?: any };//! consider defining a proper type for user


// All routes here are under /api/... (matches nginx proxy_pass to this app)
const api = express.Router();
const { registerUser, loginUser} = require('./prisma/auth');

api.post('/auth/register', async (req: ApiRequest, res: Response) => {
  try{
    const auth = await registerUser(req.body);
    res.status(201).json({ message: 'User registered!', ...auth });
  } catch (error) {
    res.status(400).json({ message: 'Failed to register user',
        error: error instanceof Error ? error.message : String(error) });
  }
});

api.post('/auth/login', async (req: ApiRequest, res: Response) => {
  try{
    const auth = await loginUser(req.body);

    if (!auth) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    res.status(200).json({ message: 'User is logged in!', ...auth });
  } catch (error) {
    res.status(400).json({ message: 'Failed to log in!',
        error: error instanceof Error ? error.message : String(error) });
  }
});

api.get('/auth/me', authenticateToken, (req: ApiRequest, res: Response) => {
  res.json({ user: req.user });
});

// to check
// curl http://localhost:3000/api/something
// curl http://localhost:3000/api/users/7

//app.get('/', (req, res) => {
//  res.send('Hello World!');
//});

// GET /api/something  → exact path
//api.get('/something', (req, res) => {
//  res.json({ message: 'handled /api/something' });
//});

// GET /api/users/42  → param "id"
api.get('/users/:id', (req: ApiRequest, res: Response) => {
  res.json({ userId: req.params.id });
});

// POST /api/items  (example)
//api.post('/items', (req, res) => {
//  res.status(201).json({ received: req.body });
//});

app.use('/api', api);

app.get('/health', (req: ApiRequest, res: Response) => {
  res.json({ status: 'OK' });
}); //#3

// app.use('/api/auth', authRoutes); //#1
// app.use('/api/user', require('./routes/user.routes')); //!can be normally named as in prev line
// app.use('/api/game', require('./routes/matchmaking.routes'));//! -||-


// all about server info is in 'server.about.txt' in the root of the 'backend' folder.