import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { ValidationException } from '@exceptions/HttpExcetion';

export const validate = <T extends z.Schema>(schema: T, property: 'body' | 'query' | 'params' = 'body') => {
    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req[property]);

        if (!result.success) {
            const errors: Record<string, string[]> = {};
            (result.error as ZodError).issues.forEach((err) => {
                const path = err.path.join('.');
                if (!errors[path]) {
                    errors[path] = [];
                }
                errors[path].push(err.message);
            });

            return next(new ValidationException('Validation failed', errors));
        }

        // req[property] = result.data;
        Object.assign(req[property], result.data);
        next();
    };
};

export const validateBody = <T extends z.Schema>(schema: T) => validate(schema, 'body');
export const validateQuery = <T extends z.Schema>(schema: T) => validate(schema, 'query');
export const validateParams = <T extends z.Schema>(schema: T) => validate(schema, 'params');

export const validateObjectId = (paramName: string = 'id') => {
    return (req: Request, res: Response, next: NextFunction) => {
        const objectIdPattern = /^[0-9a-fA-F]{24}$/;
        const id = req.params[paramName];

        if (!id || !objectIdPattern.test(id)) {
            return next(new ValidationException(`Invalid ${paramName} format`));
        }

        next();
    };
};

export const validateParamAndBody = <T extends z.Schema, U extends z.Schema>(
    paramSchema: T, 
    bodySchema: U
) => {
    return [
        validateParams(paramSchema),
        validateBody(bodySchema)
    ];
};

export default validate;