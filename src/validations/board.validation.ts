import { z } from 'zod';

// Create board
export const createBoardSchema = z.object({
    procedureId: z.string().min(1, 'Procedure ID is required'),
    name: z.string().min(1, 'Board name is required').max(100, 'Board name too long'),
    description: z.string().max(500, 'Description too long').optional(),
    members: z.array(z.string().min(1)).optional().default([]),
});

// Update board
export const updateBoardSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional().nullable(),
    members: z.array(z.string().min(1)).optional(),
});

// Update board elements (Excalidraw data) - separate endpoint for saving
export const updateBoardElementsSchema = z.object({
    elements: z.array(z.any()).optional(),
    appState: z.record(z.string(), z.any()).optional(),
    files: z.record(z.string(), z.any()).optional().nullable(),
});

// Board params
export const boardParamSchema = z.object({
    id: z.string().min(1, 'Clinic ID is required'),
    boardId: z.string().min(1, 'Board ID is required'),
});

// Clinic param only
export const clinicBoardParamSchema = z.object({
    id: z.string().min(1, 'Clinic ID is required'),
});

// Procedure boards param
export const procedureBoardsParamSchema = z.object({
    id: z.string().min(1, 'Clinic ID is required'),
    procedureId: z.string().min(1, 'Procedure ID is required'),
});

export type CreateBoardDTO = z.infer<typeof createBoardSchema>;
export type UpdateBoardDTO = z.infer<typeof updateBoardSchema>;
export type UpdateBoardElementsDTO = z.infer<typeof updateBoardElementsSchema>;
export type BoardParamDTO = z.infer<typeof boardParamSchema>;
export type ClinicBoardParamDTO = z.infer<typeof clinicBoardParamSchema>;
export type ProcedureBoardsParamDTO = z.infer<typeof procedureBoardsParamSchema>;

export default {
    create: createBoardSchema,
    update: updateBoardSchema,
    updateElements: updateBoardElementsSchema,
    param: boardParamSchema,
    clinicParam: clinicBoardParamSchema,
    procedureBoardsParam: procedureBoardsParamSchema,
};