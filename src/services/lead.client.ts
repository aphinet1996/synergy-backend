import { LEAD_API_BASE_URL, LEAD_API_KEY } from '@config/index';
import { InternalServerException, BadRequestException } from '@exceptions/HttpExcetion';
import { logger } from '@utils/logger';

interface LeadApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
    };
}

const ensureConfigured = () => {
    if (!LEAD_API_BASE_URL || !LEAD_API_KEY) {
        throw new InternalServerException(
            'Lead API is not configured. Please set LEAD_API_BASE_URL and LEAD_API_KEY in environment variables.'
        );
    }
};

const buildUrl = (path: string, query?: Record<string, string | number | undefined>): string => {
    const url = new URL(`${LEAD_API_BASE_URL}${path}`);
    if (query) {
        Object.entries(query).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                url.searchParams.append(key, String(value));
            }
        });
    }
    return url.toString();
};

interface RequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    query?: Record<string, string | number | undefined>;
    body?: Record<string, any>;
}

export const leadApiRequest = async <T = any>(
    path: string,
    options: RequestOptions = {}
): Promise<T> => {
    ensureConfigured();

    const { method = 'GET', query, body } = options;
    const url = buildUrl(path, query);

    try {
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': LEAD_API_KEY as string,
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
        });

        const text = await response.text();
        const json: LeadApiResponse<T> = text ? JSON.parse(text) : { success: response.ok };

        if (!response.ok || !json.success) {
            const message = json.error?.message || `Lead API request failed (${response.status})`;
            logger.warn('Lead API: request failed', {
                path,
                method,
                status: response.status,
                error: json.error,
            });
            throw new BadRequestException(message, json.error);
        }

        return json.data as T;
    } catch (error: any) {
        if (error instanceof BadRequestException) throw error;
        logger.error('Lead API: network/parse error', { path, method, error: error.message });
        throw new InternalServerException('Failed to communicate with Lead API');
    }
};

export const leadApiUpload = async <T = any>(
    path: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
    fieldName: string
): Promise<T> => {
    ensureConfigured();

    const url = buildUrl(path);
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(file.buffer)], { type: file.mimetype });
    formData.append(fieldName, blob, file.originalname);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'X-API-Key': LEAD_API_KEY as string,
            },
            body: formData as any,
        });

        const text = await response.text();
        const json: LeadApiResponse<T> = text ? JSON.parse(text) : { success: response.ok };

        if (!response.ok || !json.success) {
            const message = json.error?.message || `Lead API upload failed (${response.status})`;
            logger.warn('Lead API: upload failed', { path, fieldName, status: response.status });
            throw new BadRequestException(message, json.error);
        }

        return json.data as T;
    } catch (error: any) {
        if (error instanceof BadRequestException) throw error;
        logger.error('Lead API: upload error', { path, error: error.message });
        throw new InternalServerException('Failed to upload file to Lead API');
    }
};