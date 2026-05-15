const express = require('express');
const cors = require('cors');

// const authRoutes = require('./routes/auth.routes');

const app = express();
const { authenticateToken } = require('./middleware/httpAuth');

app.use(cors()); //#2
app.use(express.json());

// All routes here are under /api/... (matches nginx proxy_pass to this app)
const api = express.Router();
const { registerUser, loginUser} = require('./prisma/auth');

api.post('/auth/register', async (req, res) => {
  try{
    const auth = await registerUser(req.body);
    res.status(201).json({ message: 'User registered!', ...auth });
  } catch (error) {
    res.status(400).json({ message: 'Failed to register user', error: error.message });
  }
});

api.post('/auth/login', async (req, res) => {
  try{
    const auth = await loginUser(req.body);

    if (!auth) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    res.status(200).json({ message: 'User is logged in!', ...auth });
  } catch (error) {
    res.status(400).json({ message: 'Failed to log in!', error: error.message });
  }
});

api.get('/auth/me', authenticateToken, (req, res) => {
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
api.get('/users/:id', (req, res) => {
  res.json({ userId: req.params.id });
});

// POST /api/items  (example)
//api.post('/items', (req, res) => {
//  res.status(201).json({ received: req.body });
//});

app.use('/api', api);

app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
}); //#3

// app.use('/api/auth', authRoutes); //#1
// app.use('/api/user', require('./routes/user.routes')); //!can be normally named as in prev line
// app.use('/api/game', require('./routes/matchmaking.routes'));//! -||-

module.exports = app;


// all about server info is in 'server.about.txt' in the root of the 'backend' folder.