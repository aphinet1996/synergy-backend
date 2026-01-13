import { z } from 'zod';

const passwordPattern = /^(?=.*\d).{6,}$/;

export type RegisterDTO = z.infer<typeof authValidation.register>;
export type LoginDTO = z.infer<typeof authValidation.login>;
export type RefreshTokenDTO = z.infer<typeof authValidation.refreshToken>;
export type ChangePasswordDTO = z.infer<typeof authValidation.changePassword>;
export type ForgotPasswordDTO = z.infer<typeof authValidation.forgotPassword>;
export type ResetPasswordDTO = z.infer<typeof authValidation.resetPassword>;
export type UpdateProfileDTO = z.infer<typeof authValidation.updateProfile>;

export const authValidation = {
    register: z.object({
        username: z.string()
            .min(1, 'Username is required')
            .transform((val) => val.toLowerCase().trim()),
        password: z.string()
            .min(6, 'Password must be at least 6 characters long')
            .regex(passwordPattern, 'Password must contain at least one number'),
        confirmPassword: z.string()
            .min(1, 'Confirm password is required'),
        firstName: z.string()
            .trim()
            .min(2, 'First name must be at least 2 characters long')
            .max(50, 'First name cannot exceed 50 characters')
            .min(1, 'First name is required'),
        lastName: z.string()
            .trim()
            .min(2, 'Last name must be at least 2 characters long')
            .max(50, 'Last name cannot exceed 50 characters')
            .min(1, 'Last name is required'),
        role: z.enum(['admin', 'manager', 'employee']).optional().default('employee'),
    }).superRefine((data, ctx) => {  // Cross-field validation
        if (data.confirmPassword !== data.password) {
            ctx.addIssue({
                code: 'custom',
                message: 'Passwords do not match',
                path: ['confirmPassword'],
            });
        }
    }),

    login: z.object({
        username: z.string()
            .min(1, 'Username is required')
            .transform((val) => val.toLowerCase().trim()),
        password: z.string().min(1, 'Password is required'),
    }),

    refreshToken: z.object({
        refreshToken: z.string().min(1, 'Refresh token is required'),
    }),

    changePassword: z.object({
        currentPassword: z.string().min(1, 'Current password is required'),
        newPassword: z.string()
            .min(6, 'New password must be at least 6 characters long')
            .regex(passwordPattern, 'New password must contain at least one number'),
        confirmPassword: z.string()
            .min(1, 'Confirm new password is required'),
    }).superRefine((data, ctx) => {  // Cross-field validation
        if (data.newPassword === data.currentPassword) {
            ctx.addIssue({
                code: 'custom',
                message: 'New password must be different from current password',
                path: ['newPassword'],
            });
        }
        if (data.confirmPassword !== data.newPassword) {
            ctx.addIssue({
                code: 'custom',
                message: 'Passwords do not match',
                path: ['confirmPassword'],
            });
        }
    }),

    forgotPassword: z.object({
        username: z.string()
            .min(1, 'Username is required')
            .transform((val) => val.toLowerCase().trim()),
    }),

    resetPassword: z.object({
        token: z.string().min(1, 'Reset token is required'),
        newPassword: z.string()
            .min(6, 'Password must be at least 6 characters long')
            .regex(passwordPattern, 'Password must contain at least one number'),
        confirmPassword: z.string()
            .min(1, 'Confirm password is required'),
    }).superRefine((data, ctx) => {
        if (data.confirmPassword !== data.newPassword) {
            ctx.addIssue({
                code: 'custom',
                message: 'Passwords do not match',
                path: ['confirmPassword'],
            });
        }
    }),

    updateProfile: z.object({
        firstName: z.string()
            .trim()
            .min(2, 'First name must be at least 2 characters long')
            .max(50, 'First name cannot exceed 50 characters')
            .optional(),
        lastName: z.string()
            .trim()
            .min(2, 'Last name must be at least 2 characters long')
            .max(50, 'Last name cannot exceed 50 characters')
            .optional(),
        avatar: z.string()
            .url('Avatar must be a valid URL')
            .or(z.literal('').or(z.null()))
            .optional(),
    }),
};

export default authValidation;