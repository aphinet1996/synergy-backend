import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { ORIGIN, CREDENTIALS } from '@config/index';
import { initBoardSocket } from '@sockets/board.socket';

let io: Server;

export const initSocket = (httpServer: HttpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: ORIGIN,
            methods: ['GET', 'POST'],
            credentials: CREDENTIALS,
        },
        transports: ['websocket', 'polling'],
    });

    // Initialize board socket
    initBoardSocket(io);

    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized');
    }
    return io;
};