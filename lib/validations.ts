import { z } from 'zod';

export const createSnippetSchema = z.object({
  title: z.string().min(1, 'タイトルは必須').max(200),
  description: z.string().max(1000).optional(),
  html: z.string().min(1, 'HTMLコードは必須').max(100000),
});

export const updateSnippetSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  html: z.string().min(1).max(100000).optional(),
  is_public: z.boolean().optional(),
});
