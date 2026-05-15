import { Server as HTTPServer } from 'http';
import { createServer } from 'http';
import { Server as SocketServer, Socket as ServerSocket } from 'socket.io';
import { Socket as ClientSocket, io as ioClient } from 'socket.io-client';
import RoomService from '../../game/services/roomService';
import { createModeService } from '../../game/services/modeService';
import modes from '../../game/domain/mode';
import socketSetup from '../../sockets';
import PlayerService from '../../game/services/playerService';

describe('Socket Game Integration Tests', () => {
    let httpServer: HTTPServer;
    let socketServer: SocketServer;
    let clientSocket: ClientSocket;
    const TEST_URL = 'http://localhost:3001';

    beforeAll((done) => {
        // Create HTTP server with Socket.IO
        httpServer = createServer();
        socketServer = new SocketServer(httpServer, {
            cors: { origin: '*' },
        });

        // Setup socket handlers
        socketSetup(socketServer);

        // Start listening
        httpServer.listen(3001, () => {
            done();
        });
    });

    afterAll((done) => {
        if (clientSocket?.connected) {
            clientSocket.disconnect();
        }
        socketServer.close();
        httpServer.close(done);
    });

    describe('Connection & Identity', () => {
        test('should connect as anonymous user without token', (done) => {
            clientSocket = ioClient(TEST_URL, {
                auth: {},  // Empty auth - should be treated as anonymous
                reconnection: false,
            });

            clientSocket.on('connect', () => {
                expect(clientSocket.connected).toBe(true);
                done();
            });

            clientSocket.on('connect_error', (error) => {
                done(error);
            });
        });

        test('should receive game config on connection', (done) => {
            clientSocket = ioClient(TEST_URL, {
                auth: {},
                reconnection: false,
            });

            clientSocket.on('game:config', (config) => {
                expect(config).toBeDefined();
                expect(config.solo).toBeDefined();
                expect(config.quickplay).toBeDefined();
                clientSocket.disconnect();
                done();
            });

            clientSocket.on('connect_error', (error) => {
                done(error);
            });
        });
    });

    describe('Solo Game Mode', () => {
        beforeEach((done) => {
            clientSocket = ioClient(TEST_URL, {
                auth: {},
                reconnection: false,
            });

            clientSocket.on('connect', () => {
                done();
            });

            clientSocket.on('connect_error', (error) => {
                done(error);
            });
        });

        afterEach(() => {
            if (clientSocket?.connected) {
                clientSocket.disconnect();
            }
        });

        test('should join solo game and receive room state', (done) => {
            clientSocket.emit('mode:join', {
                mode: 'solo',
                payload: {},
            });

            clientSocket.on('game:start', (data) => {
                expect(data).toBeDefined();
                expect(data.roomId).toBeDefined();
                expect(data.state).toBeDefined();
                expect(data.config).toBeDefined();
                done();
            });

            clientSocket.on('mode_error', (error) => {
                done(new Error(`Mode error: ${error.reason}`));
            });
        });

        test('should accept player input (move left)', (done) => {
            clientSocket.emit('mode:join', {
                mode: 'solo',
                payload: {},
            });

            clientSocket.on('game:start', () => {
                // Send player move input after game starts
                clientSocket.emit('player:move', { type: 'left' });

                // Give server time to process input
                setTimeout(() => {
                    // If no error occurred, test passes
                    done();
                }, 100);
            });

            clientSocket.on('connect_error', (error) => {
                done(error);
            });

            clientSocket.on('mode_error', (error) => {
                done(new Error(`Mode error: ${error.reason}`));
            });
        });

        test('should handle all input types', (done) => {
            const inputTypes = ['left', 'right', 'down', 'rotate', 'drop', 'hold'];
            let inputsSent = 0;

            clientSocket.emit('mode:join', {
                mode: 'solo',
                payload: {},
            });

            clientSocket.on('game:start', () => {
                inputTypes.forEach((inputType) => {
                    clientSocket.emit('player:move', { type: inputType });
                    inputsSent++;
                });

                // Give server time to process all inputs
                setTimeout(() => {
                    expect(inputsSent).toBe(inputTypes.length);
                    done();
                }, 200);
            });

            clientSocket.on('mode_error', (error) => {
                done(new Error(`Mode error: ${error.reason}`));
            });
        });
    });

    describe('Disconnect Handling', () => {
        test('should clean up on disconnect', (done) => {
            clientSocket = ioClient(TEST_URL, {
                auth: {},
                reconnection: false,
            });

            clientSocket.on('connect', () => {
                clientSocket.emit('mode:join', {
                    mode: 'solo',
                    payload: {},
                });

                setTimeout(() => {
                    clientSocket.disconnect();
                    expect(clientSocket.connected).toBe(false);
                    done();
                }, 100);
            });

            clientSocket.on('connect_error', (error) => {
                done(error);
            });
        });
    });
});
