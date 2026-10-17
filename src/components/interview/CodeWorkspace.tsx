'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { FaPlay } from 'react-icons/fa';
import Button from '../ui/Button';
import { getAuthToken } from '../../services/auth';
import type { CodeAnswer } from '../../types';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

interface CodeWorkspaceProps {
  value: CodeAnswer;
  onChange: (value: CodeAnswer) => void;
}

export default function CodeWorkspace({ value, onChange }: CodeWorkspaceProps) {
  const [editorTheme, setEditorTheme] = useState<'vs' | 'vs-dark'>('vs-dark');
  const [isRunning, setIsRunning] = useState(false);
  const [runMessage, setRunMessage] = useState('');
  const [timeMs, setTimeMs] = useState<number | null>(null);

  useEffect(() => {
    const updateTheme = () => {
      setEditorTheme(document.documentElement.dataset.theme === 'light' ? 'vs' : 'vs-dark');
    };

    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const runCode = async () => {
    setIsRunning(true);
    setRunMessage('');
    setTimeMs(null);

    try {
      const token = await getAuthToken();
      const response = await fetch('/api/code/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          language: value.language,
          source: value.source,
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (response.status === 501) {
        setRunMessage(result.message || 'Code runner is not configured.');
        return;
      }

      if (!response.ok) {
        setRunMessage(result.message || 'Code execution failed.');
        return;
      }

      onChange({
        ...value,
        stdout: typeof result.stdout === 'string' ? result.stdout : '',
        stderr: typeof result.stderr === 'string' ? result.stderr : '',
      });
      setTimeMs(typeof result.timeMs === 'number' ? result.timeMs : null);
    } catch {
      setRunMessage('Unable to reach the code runner.');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-bg-surface shadow-soft overflow-hidden text-left" data-secure="input">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-bg-surface-alt px-4 py-3">
        <label className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
          Language
          <select
            value={value.language}
            onChange={(event) => onChange({ ...value, language: event.target.value as CodeAnswer['language'] })}
            className="rounded-lg border border-border bg-bg-surface px-2 py-1.5 text-xs text-text-primary outline-none focus:border-primary"
          >
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
          </select>
        </label>
        <Button type="button" size="sm" icon={FaPlay} onClick={runCode} disabled={isRunning}>
          {isRunning ? 'Running...' : 'Run'}
        </Button>
      </div>

      <div className="h-72 border-b border-border">
        <MonacoEditor
          height="100%"
          language={value.language}
          theme={editorTheme}
          value={value.source}
          onChange={(source) => onChange({ ...value, source: source ?? '' })}
          options={{ minimap: { enabled: false }, fontSize: 13, automaticLayout: true, tabSize: 2 }}
        />
      </div>

      <div className="space-y-3 bg-bg-surface-alt p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Output</h3>
          {timeMs !== null && <span className="font-mono text-[11px] text-text-secondary">{timeMs} ms</span>}
        </div>
        {runMessage && <p className="text-sm text-warning">{runMessage}</p>}
        <pre className="min-h-16 whitespace-pre-wrap rounded-lg border border-border bg-bg-surface p-3 font-mono text-xs text-text-primary">
          {value.stdout || '(no stdout)'}
        </pre>
        {value.stderr && (
          <pre className="whitespace-pre-wrap rounded-lg border border-danger/30 bg-danger/5 p-3 font-mono text-xs text-danger">
            {value.stderr}
          </pre>
        )}
      </div>
    </section>
  );
}