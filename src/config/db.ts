import mongoose from 'mongoose';
import { DB_HOST, DB_PORT, DB_DATABASE } from '@config/index';
import { logger } from '@utils/logger'

const mongooseOptions: mongoose.ConnectOptions = {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
};

export const connectDB = async (): Promise<typeof mongoose> => {
    try {
        const mongoUri = `mongodb://${DB_HOST}:${DB_PORT}/${DB_DATABASE}`;

        if (!DB_HOST || !DB_PORT || !DB_DATABASE) {
            const errorMsg = 'DB_HOST, DB_PORT, or DB_DATABASE not defined in environment variables';
            logger?.error(errorMsg);
            throw new Error(errorMsg);
        }

        if (!mongoUri) {
            throw new Error('MONGODB_URI is not defined in environment variables');
        }

        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }

        console.log('Connecting to MongoDB...');

        const connection = await mongoose.connect(mongoUri, mongooseOptions);

        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('MongoDB disconnected');
        });

        mongoose.connection.on('reconnected', () => {
            console.info('MongoDB reconnected');
        });

        process.on('SIGINT', async () => {
            await mongoose.connection.close();
            process.exit(0);
        });

        return connection;

    } catch (error) {
        console.error('MongoDB connection error:', error);
        logger.error(error);
        throw error;
    }
};

export const closeDB = async (): Promise<void> => {
    try {
        await mongoose.connection.close();
        console.info('MongoDB connection closed');
    } catch (error: any) {
        console.error(`Error closing MongoDB connection: ${error.message}`);
        throw error;
    }
};

export default mongoose;