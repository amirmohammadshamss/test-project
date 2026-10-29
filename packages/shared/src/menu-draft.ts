import { z } from 'zod';
export const menuDraftSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000),
  priceToman: z.number().int().min(1).max(100000000),
  category: z.enum([
    'برگر',
    'پیتزا',
    'نوشیدنی',
    'پیش‌غذا',
    'دسر',
    'غذاهای ایرانی',
    'سایر',
  ]),
});
export const menuDraftJsonSchema = z.toJSONSchema(
  menuDraftSchema.extend({
    priceToman: z.number().int().min(0).max(100000000),
  }),
);
export const menuCategories = [
  'برگر',
  'پیتزا',
  'نوشیدنی',
  'پیش‌غذا',
  'دسر',
  'غذاهای ایرانی',
  'سایر',
];
