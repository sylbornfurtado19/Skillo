import { z } from 'zod';
import { getAiKeyEnvName, isAiConfigured } from '@/lib/ai/aiConfig';

// Guard against browser execution
if (typeof window !== 'undefined') {
  throw new Error('[Security Violation] src/lib/server/env cannot be imported in client components.');
}

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  ANTHROPIC_API_KEY: z.string().min(10, 'ANTHROPIC_API_KEY is too short').optional(),
  GROQ_API_KEY: z.string().min(10, 'GROQ_API_KEY is too short').optional(),
  AI_PROVIDER: z.enum(['anthropic', 'groq']).optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
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
    'NEXT_PUBLIC_GROQ_API_KEY',
    'NEXT_PUBLIC_FIREBASE_PRIVATE_KEY',
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

  // 3. In production, required cloud variables must exist
  if (isProd) {
    const projectId = env.FIREBASE_PROJECT_ID || env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || env.NEXT_PUBLIC_SUPABASE_URL;
    if (!projectId) {
      errors.FIREBASE_PROJECT_ID = ['FIREBASE_PROJECT_ID is strictly required in production.'];
    }
    if (!isAiConfigured(env)) {
      warnings.push(`${getAiKeyEnvName(env)} is not set in production. AI evaluation endpoints will operate in degraded fallback mode.`);
    }
  } else {
    // Development/test notices
    if (!isAiConfigured(env)) {
      warnings.push(`${getAiKeyEnvName(env)} is not configured. AI evaluations will use deterministic analytical fallbacks.`);
    }
  }

  const isValid = Object.keys(errors).length === 0;
  const isProductionReady = isValid && Boolean(isAiConfigured(env));

  return {
    isValid,
    isProductionReady,
    errors,
    warnings,
  };
}


/**
 * Returns validated server env.
 * In build phase or when strict is false, logs a build-safe warning instead of throwing,
 * ensuring production static generation/prerender succeeds even if runtime secrets are absent.
 */
export function getServerEnv(options: { strict?: boolean } = {}): ServerEnv {
  const result = validateEnvironment();
  const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build' ||
                       process.env.BUILD_PHASE === 'true';

  if (!result.isValid && process.env.NODE_ENV === 'production') {
    if (options.strict && !isBuildPhase) {
      throw new Error(`[Production Environment Validation Failed]: ${JSON.stringify(result.errors)}`);
    } else {
      console.warn('[Server Env Warning]: Missing environment variables (build-safe fallback):', result.errors);
    }
  }
  return {
    NODE_ENV: (process.env.NODE_ENV as any) || 'development',
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    AI_PROVIDER: process.env.AI_PROVIDER as ServerEnv['AI_PROVIDER'],
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
  };
}
