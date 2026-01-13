// import { config } from 'dotenv';
// import type { Secret, SignOptions } from 'jsonwebtoken';

// config({ path: `.env.${process.env.NODE_ENV || 'development'}.local` });

// export const CREDENTIALS = process.env.CREDENTIALS === 'true';
// export const { NODE_ENV, API_URI, PORT, SECRET_KEY, LOG_FORMAT, LOG_DIR, ORIGIN,LOG_LEVEL } = process.env;
// export const { DB_HOST, DB_PORT, DB_DATABASE } = process.env;

// export const JWT_SECRET: Secret = process.env.JWT_SECRET as Secret;
// export const JWT_REFRESH_SECRET: string = process.env.JWT_REFRESH_SECRET;
// export const JWT_EXPIRE: SignOptions['expiresIn'] = (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'];
// export const JWT_REFRESH_EXPIRE: SignOptions['expiresIn'] = (process.env.JWT_EXPIRES_IN || '30d') as SignOptions['expiresIn'];

import { config } from 'dotenv';
import type { Secret, SignOptions } from 'jsonwebtoken';

config({ path: `.env.${process.env.NODE_ENV || 'development'}.local` });

export const CREDENTIALS = process.env.CREDENTIALS === 'true';
export const { NODE_ENV, API_URI, PORT, SECRET_KEY, LOG_FORMAT, LOG_DIR, ORIGIN, LOG_LEVEL } = process.env;
export const { MONGODB_URI } = process.env;

// JWT
export const JWT_SECRET: Secret = process.env.JWT_SECRET as Secret;
export const JWT_REFRESH_SECRET: string = process.env.JWT_REFRESH_SECRET as string;
export const JWT_EXPIRE: SignOptions['expiresIn'] = (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'];
export const JWT_REFRESH_EXPIRE: SignOptions['expiresIn'] = (process.env.JWT_EXPIRES_IN || '30d') as SignOptions['expiresIn'];

// Upload Configuration
export const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT || 3000}`;
export const UPLOADS_PATH = process.env.UPLOADS_PATH || '/uploads';