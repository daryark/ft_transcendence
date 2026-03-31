const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ message: 'Server is running!' });
});

app.use('/api/auth', authRoutes);

module.exports = app;
