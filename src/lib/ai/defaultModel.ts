/**
 * Single source of truth for the default Anthropic model id.
 * Kept free of server-only code so both server engines (aiConfig.ts) and
 * client helpers can import it. Override at runtime with ANTHROPIC_MODEL.
 */
export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-5-5';
