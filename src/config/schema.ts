import { z } from "zod";

const nonEmpty = z.string().trim().min(1);

export const finanzonlineSchema = z.object({
  tid: z.string().regex(/^[0-9A-Za-z]{8,12}$/),
  benid: z.string().min(5).max(12),
  pin: z.string().min(5).max(128),
  herstellerid: z.string().regex(/^[0-9A-Za-z]{10,24}$/),
  output_dir: nonEmpty,
  session_timeout: z.number().int().positive().optional().default(30),
  query_timeout: z.number().int().positive().optional().default(30)
});

export type FinanzonlineConfig = z.infer<typeof finanzonlineSchema>;

export const finanzonlinePartialSchema = finanzonlineSchema.partial({
  tid: true,
  benid: true,
  pin: true,
  herstellerid: true,
  output_dir: true
});

export type FinanzonlineConfigInput = z.input<typeof finanzonlinePartialSchema>;
