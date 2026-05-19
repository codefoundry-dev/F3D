import { z } from 'zod';

import { LocationType, ProjectStatus } from '../enums';

const locationSchema = z.object({
  type: z.enum([LocationType.DELIVERY, LocationType.STORAGE]),
  address: z.string().min(1, 'Address is required'),
  label: z.string().optional(),
  isDefault: z.boolean(),
});

export const createProjectSchema = z
  .object({
    name: z.string().min(1, 'Project name is required').max(255),
    description: z.string().optional(),
    type: z.string().optional(),
    status: z
      .enum([
        ProjectStatus.PLANNED,
        ProjectStatus.ONGOING,
        ProjectStatus.COMPLETED,
        ProjectStatus.ARCHIVED,
      ])
      .optional()
      .default(ProjectStatus.PLANNED),
    locations: z
      .array(locationSchema)
      .min(1, 'At least one location is required')
      .refine((locs) => locs.some((l) => l.type === LocationType.DELIVERY && l.isDefault), {
        message: 'At least one default delivery location is required',
      })
      .refine((locs) => locs.some((l) => l.type === LocationType.STORAGE && l.isDefault), {
        message: 'At least one default storage location is required',
      })
      .refine(
        (locs) => locs.filter((l) => l.type === LocationType.DELIVERY && l.isDefault).length <= 1,
        {
          message: 'Only one default delivery location is allowed',
        },
      )
      .refine(
        (locs) => locs.filter((l) => l.type === LocationType.STORAGE && l.isDefault).length <= 1,
        {
          message: 'Only one default storage location is allowed',
        },
      ),
    assignedUserIds: z.array(z.string().uuid()).min(1, 'At least one team member is required'),
    plannedBudget: z.number().min(0).optional(),
    currency: z.string().max(3).optional().default('AUD'),
    pointOfContactId: z.string().uuid().optional(),
    startDate: z.string().optional(),
    expectedEndDate: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.expectedEndDate) {
        return new Date(data.expectedEndDate) > new Date(data.startDate);
      }
      return true;
    },
    {
      message: 'Expected end date must be after start date',
      path: ['expectedEndDate'],
    },
  );

export const updateProjectSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    type: z.string().optional(),
    status: z
      .enum([
        ProjectStatus.PLANNED,
        ProjectStatus.ONGOING,
        ProjectStatus.COMPLETED,
        ProjectStatus.ARCHIVED,
      ])
      .optional(),
    locations: z
      .array(locationSchema)
      .min(1)
      .refine((locs) => locs.some((l) => l.type === LocationType.DELIVERY && l.isDefault), {
        message: 'At least one default delivery location is required',
      })
      .refine((locs) => locs.some((l) => l.type === LocationType.STORAGE && l.isDefault), {
        message: 'At least one default storage location is required',
      })
      .refine(
        (locs) => locs.filter((l) => l.type === LocationType.DELIVERY && l.isDefault).length <= 1,
        {
          message: 'Only one default delivery location is allowed',
        },
      )
      .refine(
        (locs) => locs.filter((l) => l.type === LocationType.STORAGE && l.isDefault).length <= 1,
        {
          message: 'Only one default storage location is allowed',
        },
      )
      .optional(),
    assignedUserIds: z.array(z.string().uuid()).min(1).optional(),
    plannedBudget: z.number().min(0).optional(),
    currency: z.string().max(3).optional(),
    pointOfContactId: z.string().uuid().optional(),
    startDate: z.string().optional(),
    expectedEndDate: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.expectedEndDate) {
        return new Date(data.expectedEndDate) > new Date(data.startDate);
      }
      return true;
    },
    {
      message: 'Expected end date must be after start date',
      path: ['expectedEndDate'],
    },
  );

export const addProjectMembersSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1, 'At least one user is required'),
});

export type CreateProjectFormValues = z.infer<typeof createProjectSchema>;
export type UpdateProjectFormValues = z.infer<typeof updateProjectSchema>;
export type AddProjectMembersFormValues = z.infer<typeof addProjectMembersSchema>;
