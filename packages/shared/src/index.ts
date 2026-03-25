import { z } from "zod";

export const TicketStatusSchema = z.enum(["abierto", "en_proceso", "resuelto"]);
export const TicketPrioritySchema = z.enum(["baja", "media", "alta", "urgente"]);
export const WingSchema = z.enum(["a", "b", "connector"]);

export const Point3DSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

export const TicketCommentSchema = z.object({
  id: z.string(),
  text: z.string(),
  at: z.string(),
});

export const TicketSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: TicketStatusSchema,
  priority: TicketPrioritySchema,
  category: z.string(),
  wing: WingSchema,
  floor: z.number().min(1).max(4),
  createdAt: z.string(),
  updatedAt: z.string(),
  comments: z.array(TicketCommentSchema),
  attachments: z.array(z.string()),
  location: Point3DSchema.optional(),
});

export const LoginSchema = z.object({
  email: z.email(),
  password: z.string().min(4),
});

export const TicketCreateSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(5),
  priority: TicketPrioritySchema,
  category: z.string().min(2),
  wing: WingSchema,
  floor: z.number().min(1).max(4),
  location: Point3DSchema.optional(),
});

export const TicketPatchSchema = z.object({
  status: TicketStatusSchema.optional(),
  commentText: z.string().optional(),
  location: Point3DSchema.optional(),
});

export const UserLocationSchema = z.object({
  wing: WingSchema,
  floor: z.number().min(1).max(4),
  point: Point3DSchema,
});

export type TicketStatus = z.infer<typeof TicketStatusSchema>;
export type TicketPriority = z.infer<typeof TicketPrioritySchema>;
export type Wing = z.infer<typeof WingSchema>;
export type Point3D = z.infer<typeof Point3DSchema>;
export type TicketComment = z.infer<typeof TicketCommentSchema>;
export type Ticket = z.infer<typeof TicketSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type TicketCreateInput = z.infer<typeof TicketCreateSchema>;
export type TicketPatchInput = z.infer<typeof TicketPatchSchema>;
export type UserLocationInput = z.infer<typeof UserLocationSchema>;
