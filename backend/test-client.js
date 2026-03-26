const { io } = require("socket.io-client");

const socket = io("http://localhost:3000");

socket.on("connect", () => {
    console.log("Connected:", socket.id);

    socket.emit("join_room", "room1");

    setTimeout(() => {
        socket.emit("chat:message", {
            roomId: "room1",
            message: "hello room"
        });
    }, 1000);
});

socket.on("chat:message", (data) => {
    console.log("Chat:", data);
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