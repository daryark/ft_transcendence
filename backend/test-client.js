const { io } = require("socket.io-client");

const socket = io("http://localhost:3000");

socket.on("connect", () => {
    console.log("Connected with id:", socket.id);
    socket.emit("client:ping", { msg: "hello server" });

    socket.emit("join_room", "room1");
});

socket.on("chat:message", (msg) => {
    console.log("Chat received:", msg);
});

// send message after 2 seconds
setTimeout(() => {
    socket.emit("chat:message", "hello room");
}, 2000);

socket.on("server:pong", (data) => {
    console.log("Received pong:", data);
});

socket.on("disconnect", () => {
    console.log("Disconnected");
});