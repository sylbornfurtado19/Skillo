import { z } from 'zod';

// Guard against browser execution
if (typeof window !== 'undefined') {
  throw new Error('[Security Violation] src/lib/server/env cannot be imported in client components.');
}

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL').optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, 'NEXT_PUBLIC_SUPABASE_ANON_KEY must be at least 20 characters').optional(),
  ANTHROPIC_API_KEY: z.string().min(10, 'ANTHROPIC_API_KEY is too short').optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, 'SUPABASE_SERVICE_ROLE_KEY is too short').optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export interface EnvValidationResult {
  isValid: boolean;
  isProductionReady: boolean;
  errors: Record<string, string[]>;
  warnings: string[];
}

/**
 * Validates process environment against strict server schema.
 * Detects security hazards like accidentally prefixing secrets with NEXT_PUBLIC_.
 */
export function validateEnvironment(env: Record<string, string | undefined> = process.env): EnvValidationResult {
  const warnings: string[] = [];
  const errors: Record<string, string[]> = {};

  // 1. Check for dangerous accidental public secret leaks
  const dangerousPrefixes = [
    'NEXT_PUBLIC_ANTHROPIC_API_KEY',
    'NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_SECRET',
  ];

  for (const dangerousKey of dangerousPrefixes) {
    if (env[dangerousKey]) {
      const msg = `CRITICAL SECURITY LEAK: "${dangerousKey}" is exposed to the browser! Secret keys must NEVER start with NEXT_PUBLIC_.`;
      errors[dangerousKey] = [msg];
    }
  }

  // 2. Validate using Zod schema
  const parseResult = serverEnvSchema.safeParse(env);
  if (!parseResult.success) {
    const fieldErrors = parseResult.error.flatten().fieldErrors;
    for (const [key, errs] of Object.entries(fieldErrors)) {
      if (errs && errs.length > 0) {
        errors[key] = (errors[key] || []).concat(errs);
      }
    }
  }

  const isProd = env.NODE_ENV === 'production';

  // 3. In production, required variables must strictly exist
  if (isProd) {
    if (!env.NEXT_PUBLIC_SUPABASE_URL) {
      errors.NEXT_PUBLIC_SUPABASE_URL = ['NEXT_PUBLIC_SUPABASE_URL is strictly required in production.'];
    }
    if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      errors.NEXT_PUBLIC_SUPABASE_ANON_KEY = ['NEXT_PUBLIC_SUPABASE_ANON_KEY is strictly required in production.'];
    }
    if (!env.ANTHROPIC_API_KEY) {
      warnings.push('ANTHROPIC_API_KEY is not set in production. AI evaluation endpoints will operate in degraded fallback mode.');
    }
  } else {
    // Development/test notices
    if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      warnings.push('Supabase is not configured. Running with mock/local state.');
    }
    if (!env.ANTHROPIC_API_KEY) {
      warnings.push('ANTHROPIC_API_KEY is not configured. AI evaluations will use deterministic analytical fallbacks.');
    }
  }

  const isValid = Object.keys(errors).length === 0;
  const isProductionReady = isValid && Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY && env.ANTHROPIC_API_KEY);

  return {
    isValid,
    isProductionReady,
    errors,
    warnings,
  };
}

/**
 * Returns validated server env or throws in production if invalid.
 */
export function getServerEnv(): ServerEnv {
  const result = validateEnvironment();
  if (!result.isValid && process.env.NODE_ENV === 'production') {
    throw new Error(`[Production Environment Validation Failed]: ${JSON.stringify(result.errors)}`);
  }
  return {
    NODE_ENV: (process.env.NODE_ENV as any) || 'development',
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}
