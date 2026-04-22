const express = require('express');
const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello World!');
});

// All routes here are under /api/... (matches nginx proxy_pass to this app)
const api = express.Router();
const { registerUser, loginUser} = require('../prisma/auth.ts');

// to check
// curl http://localhost:3000/api/something
// curl http://localhost:3000/api/users/7


// GET /api/something  → exact path
api.get('/something', (req, res) => {
  res.json({ message: 'handled /api/something' });
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

// POST /api/items  (example)
//api.post('/items', (req, res) => {
//  res.status(201).json({ received: req.body });
//});

app.use('/api', api);

app.listen(3000, '0.0.0.0', () => {
  console.log('Example app listening on port 3000');
});