const express = require('express');
const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello World!');
});

// All routes here are under /api/... (matches nginx proxy_pass to this app)
const api = express.Router();

// GET /api/something  → exact path
api.get('/something', (req, res) => {
  res.json({ message: 'handled /api/something' });
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
