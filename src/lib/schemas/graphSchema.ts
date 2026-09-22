/**
 * Graph Schema — Entity Normalization Dictionary
 *
 * Provides a canonical alias map for tech stack names so that variant spellings
 * (e.g. "React.js", "React 19", "ReactJS") all resolve to a single canonical
 * node ("React") before entering the Leiden hierarchical clustering engine.
 */

import { z } from "zod";

// ── Canonical Alias Map ───────────────────────────────────────────────────────
// Keys: lowercase, trimmed variant spellings.
// Values: canonical display name (title-cased, exact).
export const ENTITY_ALIAS_MAP: Record<string, string> = {
  // React variants
  "react.js": "React",
  "reactjs": "React",
  "react 19": "React",
  "react 18": "React",
  "react 17": "React",
  "react js": "React",

  // Next.js variants
  "next.js": "Next.js",
  "nextjs": "Next.js",
  "next js": "Next.js",
  "next 15": "Next.js",
  "next 14": "Next.js",
  "next 13": "Next.js",

  // Kubernetes variants
  "k8s": "Kubernetes",
  "kube": "Kubernetes",
  "k8": "Kubernetes",

  // PostgreSQL variants
  "postgres": "PostgreSQL",
  "pg": "PostgreSQL",
  "postgresql 15": "PostgreSQL",
  "postgresql 14": "PostgreSQL",

  // Node.js variants
  "node": "Node.js",
  "nodejs": "Node.js",
  "node.js": "Node.js",
  "node js": "Node.js",
  "node.js 20": "Node.js",
  "node 20": "Node.js",
  "node.js 18": "Node.js",
  "node 18": "Node.js",
  "node.js 22": "Node.js",
  "node 22": "Node.js",
  "node.js 16": "Node.js",
  "node 16": "Node.js",

  // TypeScript variants
  "ts": "TypeScript",
  "typescript 5": "TypeScript",

  // JavaScript variants
  "js": "JavaScript",
  "es6": "JavaScript",
  "es2015": "JavaScript",
  "vanilla js": "JavaScript",
  "vanilla javascript": "JavaScript",

  // MongoDB variants
  "mongo": "MongoDB",
  "mongo db": "MongoDB",

  // AWS variants
  "amazon web services": "AWS",
  "aws cloud": "AWS",

  // Google Cloud variants
  "gcp": "Google Cloud",
  "google cloud platform": "Google Cloud",

  // Azure variants
  "microsoft azure": "Azure",
  "azure cloud": "Azure",

  // Docker variants
  "docker container": "Docker",
  "docker containers": "Docker",

  // Redis variants
  "redis cache": "Redis",
  "redis cluster": "Redis",

  // Kafka variants
  "apache kafka": "Kafka",
  "kafka streams": "Kafka",

  // GraphQL variants
  "graph ql": "GraphQL",
  "graphql api": "GraphQL",

  // REST / REST API
  "rest api": "REST API",
  "restful api": "REST API",
  "rest apis": "REST API",
  "restful apis": "REST API",

  // gRPC
  "grpc": "gRPC",

  // Elasticsearch variants
  "elastic search": "Elasticsearch",
  "elastic": "Elasticsearch",

  // Vue.js variants
  "vue": "Vue.js",
  "vue3": "Vue.js",
  "vue 3": "Vue.js",
  "vue 2": "Vue.js",
  "vuejs": "Vue.js",

  // Angular variants
  "angular 17": "Angular",
  "angular 16": "Angular",
  "angular 15": "Angular",
  "angularjs": "Angular",
  "angular js": "Angular",

  // Python variants
  "python 3": "Python",
  "python3": "Python",
  "python 3.11": "Python",
  "python 3.12": "Python",

  // Go variants
  "golang": "Go",
  "go lang": "Go",

  // Rust
  "rust lang": "Rust",
  "rustlang": "Rust",

  // Terraform variants
  "tf": "Terraform",
  "hashicorp terraform": "Terraform",

  // CI/CD
  "ci/cd": "CI/CD",
  "cicd": "CI/CD",
  "ci cd": "CI/CD",
  "github actions": "GitHub Actions",
  "gh actions": "GitHub Actions",
};

/**
 * Normalizes a raw entity name to its canonical form using the alias map.
 * - Trims and lowercases for lookup.
 * - Falls back to the original (trimmed) input if no alias is found.
 */
export function normalizeEntityName(raw: string): string {
  const key = raw.trim().toLowerCase();
  return ENTITY_ALIAS_MAP[key] ?? raw.trim();
}

// ── Zod Schema ────────────────────────────────────────────────────────────────
export const entityAliasMapSchema = z.record(z.string().min(1), z.string().min(1));

/** Validates the alias map at startup to catch accidental regressions */
export function validateEntityAliasMap(): boolean {
  return entityAliasMapSchema.safeParse(ENTITY_ALIAS_MAP).success;
}
