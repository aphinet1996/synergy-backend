import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { logger, stream } from '@utils/logger';
import { errorMiddleware } from '@/middlewares/error.middleware';
import { NODE_ENV, API_URI, PORT, LOG_FORMAT, ORIGIN, CREDENTIALS, UPLOADS_PATH } from '@config/index';
import routes from '@routes/index';

class App {
    public app: Application;
    public env: string;
    public port: string | number;

    constructor() {
        this.app = express();
        this.env = NODE_ENV || 'development';
        this.port = PORT || 3000;

        this.configureMiddlewares();
        this.configureRoutes();
        this.configureErrorHandling();
    }

    private configureMiddlewares(): void {
        this.app.use(morgan(LOG_FORMAT, { stream }));
        this.app.use(cors({ origin: ORIGIN, credentials: CREDENTIALS }));
        this.app.use(helmet());
        this.app.use(compression());
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        this.app.use(
            UPLOADS_PATH,  // '/uploads'
            express.static(path.join(process.cwd(), 'uploads'), {
                maxAge: '1d',
                etag: true,
                lastModified: true,
                // Security headers
                setHeaders: (res, filePath) => {
                    // Prevent directory listing
                    res.setHeader('X-Content-Type-Options', 'nosniff');
                    // Allow cross-origin access for images/files
                    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
                    res.setHeader('Access-Control-Allow-Origin', '*');
                },
            })
        );

        // const apiLimiter = rateLimit({
        //     windowMs: 15 * 60 * 1000,
        //     max: 100,
        //     standardHeaders: true,
        //     legacyHeaders: false,
        //     message: 'Too many requests from this IP, please try again later.'
        // });
        // this.app.use(API_URI, apiLimiter);

    }

    private configureRoutes() {
        this.app.use(API_URI, routes);

        // Handle undefined API routes specifically
        this.app.use('/api/{*any}', (req: Request, res: Response) => {
            res.status(404).json({
                status: 'error',
                message: 'API endpoint not found',
                path: req.originalUrl,
                method: req.method
            });
        });

        // Handle undefined routes
        this.app.all('/{*any}', (req: Request, res: Response) => {
            res.status(404).json({
                status: 'error',
                message: `Cannot find ${req.originalUrl} on this server!`,
                method: req.method
            });
        });
    }

    private configureErrorHandling() {
        this.app.use(errorMiddleware);
    }

}

// Create app instance
const appInstance = new App();

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
    logger.error('UNCAUGHT EXCEPTION! Shutting down...', err);
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
    logger.error('UNHANDLED REJECTION! Shutting down...', err);
    process.exit(1);
});

// Export the App instance and the Express application
export { appInstance, App };
export default appInstance.app;