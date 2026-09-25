import { z } from "zod";

const INTERNAL_PHONE_EMAIL_DOMAIN = "phone.meetctrlp.app";

function emptyToUndefined(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

const emailSchema = z
  .string()
  .trim()
  .max(320)
  .email()
  .refine(
    (email) => !email.toLowerCase().endsWith(`@${INTERNAL_PHONE_EMAIL_DOMAIN}`),
    { message: "This email domain is reserved" },
  );

export const registerRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    shopName: z.string().trim().min(1).max(200),
    password: z.string().min(6).max(128),
    email: z.preprocess(emptyToUndefined, emailSchema.optional()),
    phone: z.preprocess(emptyToUndefined, z.string().trim().min(8).max(32).optional()),
  })
  .refine((value) => Boolean(value.email || value.phone), {
    message: "email or phone is required",
    path: ["email"],
  });

export const loginRequestSchema = z.object({
  identifier: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(128),
});

export const refreshRequestSchema = z.object({
  refreshToken: z.string().trim().min(1),
});

export const authTokensSchema = z.object({
  idToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresIn: z.number().int().positive(),
});

export const authSessionUserSchema = z.object({
  id: z.string().uuid(),
  shopId: z.string().uuid(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  role: z.enum(["OWNER", "MANAGER", "STAFF"]),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]),
  lastLoginAt: z.string().nullable(),
});

export const authSessionResponseSchema = z.object({
  user: authSessionUserSchema,
  tokens: authTokensSchema,
});

export const authMeResponseSchema = z.object({
  user: authSessionUserSchema,
});

export const authErrorResponseSchema = z.object({
  error: z.string(),
});

export type RegisterRequestInput = z.infer<typeof registerRequestSchema>;
export type LoginRequestInput = z.infer<typeof loginRequestSchema>;
export type RefreshRequestInput = z.infer<typeof refreshRequestSchema>;
