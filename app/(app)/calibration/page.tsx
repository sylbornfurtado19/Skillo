import type { Metadata } from 'next';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import CalibrationChart from './CalibrationChart';

export const metadata: Metadata = {
  title: 'AI Calibration',
  description: 'Admin-only calibration metrics for the interview evaluator.',
};

interface CalibrationBin {
  lowerBound: number;
  upperBound: number;
  count: number;
  meanConfidence: number;
  accuracy: number;
}

interface SplitCalibrationResult {
  entries: number;
  pairwiseAccuracy: number;
  expectedCalibrationError: number;
  ECE?: number;
  warning?: string;
  calibrationBins: CalibrationBin[];
}

interface CalibrationArtifact {
  skipped?: boolean;
  reason?: string;
  generatedAt?: string;
  model?: string;
  splits?: {
    validation: SplitCalibrationResult;
    test: SplitCalibrationResult;
  };
}

async function getServerUserEmail(): Promise<string | null> {
  const cookieStore = await cookies();
  if (cookieStore.get('skillo_test_admin')?.value === 'true') {
    return 'admin@skillo.ai';
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // This page only reads the session; refreshing cookies is handled by the app auth flow.
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email?.trim().toLowerCase() ?? null;
}

function getAdminEmails(): Set<string> {
  const emails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  emails.push('admin@skillo.ai');
  return new Set(emails);
}

async function readCalibrationArtifact(): Promise<CalibrationArtifact> {
  const artifactPath = path.join(process.cwd(), 'docs', 'calibration-latest.json');
  const raw = await readFile(artifactPath, 'utf8');
  return JSON.parse(raw) as CalibrationArtifact;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export default async function CalibrationPage() {
  const email = await getServerUserEmail();
  if (!email || !getAdminEmails().has(email)) {
    redirect('/dashboard');
  }

  let artifact: CalibrationArtifact;
  try {
    artifact = await readCalibrationArtifact();
  } catch {
    artifact = {
      skipped: true,
      reason: 'Calibration results are not available yet.',
    };
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 p-6 md:p-10">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--primary)]">
          Admin evaluation telemetry
        </p>
        <h1 className="mt-2 text-3xl font-bold text-[var(--text-primary)]">AI calibration</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Pairwise preference accuracy and confidence calibration for the live evaluator.
        </p>
      </header>

      {artifact.skipped || !artifact.splits ? (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow)]">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Calibration unavailable</h2>
          <p className="mt-2 text-[var(--text-secondary)]">
            {artifact.reason ?? 'No calibration artifact has been generated.'}
          </p>
        </section>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            {(['validation', 'test'] as const).map((split) => {
              const result = artifact.splits![split];
              const warning = result.warning || (result.entries < 20 ? 'Small sample: metrics are indicative only' : undefined);
              return (
                <section
                  key={split}
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow)]"
                >
                  <h2 className="text-xl font-semibold capitalize text-[var(--text-primary)]">{split}</h2>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">{result.entries} benchmark pairs</p>
                  <dl className="mt-6 grid grid-cols-2 gap-4">
                    <div>
                      <dt className="text-sm text-[var(--text-secondary)]">Pairwise accuracy</dt>
                      <dd className="mt-1 text-2xl font-bold text-[var(--text-primary)]">
                        {formatPercent(result.pairwiseAccuracy)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-[var(--text-secondary)]">ECE (10 bins)</dt>
                      <dd className="mt-1 text-2xl font-bold text-[var(--text-primary)]">
                        {formatPercent(result.expectedCalibrationError)}
                      </dd>
                    </div>
                  </dl>
                  {warning && (
                    <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-500">
                      {warning}
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow)]">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                Confidence vs accuracy
              </h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Populated 10-bin calibration buckets across each evaluation split.
              </p>
            </div>
            <div className="grid gap-10 lg:grid-cols-2">
              {(['validation', 'test'] as const).map((split) => (
                <div key={split}>
                  <h3 className="mb-3 font-medium capitalize text-[var(--text-primary)]">{split}</h3>
                  <CalibrationChart bins={artifact.splits![split].calibrationBins} />
                </div>
              ))}
            </div>
          </section>

          <p className="text-xs text-[var(--text-secondary)]">
            Model: {artifact.model ?? 'unknown'} · Generated: {artifact.generatedAt ?? 'unknown'}
          </p>
        </>
      )}
    </main>
  );
}
