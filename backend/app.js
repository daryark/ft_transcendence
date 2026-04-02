const express = require('express');
const cors = require('cors');

// const authRoutes = require('./routes/auth.routes');

const app = express();

app.use(cors()); //#2
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
}); //#3

// app.use('/api/auth', authRoutes); //#1
// app.use('/api/user', require('./routes/user.routes')); //!can be normally named as in prev line
// app.use('/api/game', require('./routes/matchmaking.routes'));//! -||-

module.exports = app;


// all about server info is in 'server.about.txt' in the root of the 'backend' folder.