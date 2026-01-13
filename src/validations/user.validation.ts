import { z } from 'zod';

const baseUserSchema = z.object({
  firstname: z.string()
    .trim()
    .min(2, 'First name must be at least 2 characters long')
    .max(50, 'First name cannot exceed 50 characters'),
  lastname: z.string()
    .trim()
    .min(2, 'Last name must be at least 2 characters long')
    .max(50, 'Last name cannot exceed 50 characters'),
  nickname: z.string()
    .trim()
    .min(1, 'Nickname is required')
    .max(50, 'Nickname cannot exceed 50 characters'),
  tel: z.string()
    .regex(/^\d{10}$/, 'Tel must be 10 digits')
    .optional(),
  address: z.string().max(200, 'Address cannot exceed 200 characters').optional(),
  birthDate: z.coerce.date().optional(),
  position: z.string().max(100, 'Position cannot exceed 100 characters').optional(),
  salary: z.string().optional(),
  contract: z.string().optional(),
  contractDateStart: z.coerce.date().optional(),
  contractDateEnd: z.coerce.date().optional(),
  employeeType: z.enum(['permanent', 'probation', 'freelance']),
  employeeDateStart: z.coerce.date(),
  employeeStatus: z.string().optional(),
  role: z.enum(['admin', 'manager', 'employee']),
});

// Create user (full required fields + password)
export const createUserSchema = baseUserSchema

// Update user (partial, exclude username/password/role if not admin)
export const updateUserSchema = baseUserSchema.partial()
  .extend({
    password: z.string()
      .min(6, 'Password must be at least 6 characters long')
      .regex(/^(?=.*\d).{6,}$/, 'Password must contain at least one number')
      .optional(),
    confirmPassword: z.string().min(1, 'Confirm password is required').optional(),
    role: z.enum(['admin', 'manager', 'employee']).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.password && data.confirmPassword && data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: 'custom',
        message: 'Passwords do not match',
        path: ['confirmPassword'],
      });
    }
  });

// List query params (search, filter, pagination)
export const listUserQuerySchema = z.object({
  search: z.string().optional(),
  role: z.enum(['admin', 'manager', 'employee']).optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(10),
});

export const userParamSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});

export type CreateUserDTO = z.infer<typeof createUserSchema>;
export type UpdateUserDTO = z.infer<typeof updateUserSchema>;
export type ListUserQueryDTO = z.infer<typeof listUserQuerySchema>;
export type UserParamDTO = z.infer<typeof userParamSchema>;

export default {
  create: createUserSchema,
  update: updateUserSchema,
  list: listUserQuerySchema,
  param: userParamSchema,
};