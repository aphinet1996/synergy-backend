import http from 'http';
import { appInstance } from './app';
import { connectDB } from '@config/db'
import { logger } from '@utils/logger';
import { NODE_ENV, PORT } from '@config/index';
import { initSocket } from '@sockets/index';

const server = http.createServer(appInstance.app);

initSocket(server);
logger.info('Socket.io initialized');

async function startServer() {
    try {
        await connectDB();
        logger.info(`MongoDB connected successfully`);

        server.listen(PORT, () => {
            logger.info(`=================================`);
            logger.info(`======= ENV: ${NODE_ENV} =======`);
            logger.info(`🚀 Server running in ${NODE_ENV} mode on port ${PORT}`);
            logger.info(`=================================`);
        });
    } catch (error) {
        logger.error(`Failed to start server: ${error instanceof Error ? error.message : 'Unknown error'}`);
        process.exit(1);
    }
}

// Handle server errors (e.g., port in use)
server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.syscall !== 'listen') {
        throw error;
    }
    const bind = typeof PORT === 'string' ? `Pipe ${PORT}` : `Port ${PORT}`;
    switch (error.code) {
        case 'EACCES':
            logger.error(`${bind} requires elevated privileges`);
            process.exit(1);
            break;
        case 'EADDRINUSE':
            logger.error(`${bind} is already in use`);
            process.exit(1);
            break;
        default:
            throw error;
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Shutting down gracefully');
    server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT received. Shutting down gracefully');
    server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
    });
});

startServer();

export default server;