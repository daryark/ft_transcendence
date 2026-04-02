const { io } = require("socket.io-client");

const socket = io("http://localhost:3000");

socket.on("connect", () => {
    console.log("Connected:", socket.id);

    socket.emit("join_room", "room1");

    setTimeout(() => {
        socket.emit("chat:message", {
            message: "hello room"
        });
    }, 1000);
});

socket.on("chat:message", (data) => {
    console.log("Chat:", data);
});

socket.on("server:pong", (data) => {
    console.log("Received pong:", data);
});

socket.on("disconnect", () => {
    console.log("Disconnected");
});