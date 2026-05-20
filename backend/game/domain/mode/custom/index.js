export default function join(socket, roomService, payload) {
    void payload; // placeholder for now, will be used when we add modifiers
    void roomService; // placeholder for now, will be used to manage rooms
    void socket; // placeholder for now, will be used to manage socket connections
    
    // validate payload (modifiers)
    // find or create room based on mode + modifiers
    // add player to room
    // return room state
    return roomService.getRoomState(socket.data.roomId);
}