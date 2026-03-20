const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { PORT } = require('./config/env');
const registerSocketHandlers = require('./socket');

const app = express();

//?! Understand later what I exactly need this for!?
// Says that i'll use it to mount REST routes here (auth, user, matchmaking, HTTP and so on).
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });

});
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
    cors: { origin: '*', }  //! todo - restrict in real env
});

registerSocketHandlers(io);

httpServer.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});







// app.listen(3000, () => {
//  console.log('Example app listening on port 3000!');
// });

// const PORT = process.env.PORT || 5000;
// server.listen(PORT, () => {
//     console.log('Server listening on', PORT);
// });

// io.on('connection', (socket) => {
//   console.log('socket connected:', socket.id);

//   socket.on('disconnect', () => {
//     console.log('socket disconnected:', socket.id);
//   });
// });
