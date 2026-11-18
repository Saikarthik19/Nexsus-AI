import React, { useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import {
  FlaskConical,
  Play,
  PlayCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Coins,
  Cpu,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Layers,
} from 'lucide-react';

interface ScenarioResult {
  scenarioId: number;
  passed: boolean;
  details?: any;
  error?: string;
  tokensUsed?: number;
  costUSD?: number;
  latencyMs?: number;
}

const SCENARIOS = [
  {
    id: 1,
    name: 'Incomplete Input Detection',
    description: 'Validates missing required schema fields (e.g. name, email, age) and flags missing inputs.',
  },
  {
    id: 2,
    name: 'Contradictory Information Detection',
    description: 'Detects logical discrepancies between data points (e.g., birthYear vs age mismatch).',
  },
  {
    id: 3,
    name: 'Hallucination Detection & Prevention',
    description: 'Checks answer grounding against factual document context to prevent ungrounded claims.',
  },
  {
    id: 4,
    name: 'Invalid Structured Output Handling',
    description: 'Validates JSON against strict Zod schema; triggers automated repair prompts upon malformed responses.',
  },
  {
    id: 5,
    name: 'Prompt Injection & Conflict Detection',
    description: 'Intercepts system prompt override attempts, adversarial jailbreaks, and command injections.',
  },
  {
    id: 6,
    name: 'Multi-Model Disagreement Detection',
    description: 'Compares factual extraction across distinct LLM providers (Gemini vs Groq/Mistral) to flag divergence.',
  },
  {
    id: 7,
    name: 'Provider Failure & Fallback Execution',
    description: 'Simulates primary model failure and verifies automatic handover to secondary backup provider.',
  },
  {
    id: 8,
    name: 'Long-Context Handling & Chunking',
    description: 'Splits extensive inputs into manageable chunks, verifying context-window limit compliance.',
  },
  {
    id: 9,
    name: 'Cost & Budget Enforcement',
    description: 'Tracks per-request financial cost and enforces user/system budget ceiling rules.',
  },
  {
    id: 10,
    name: 'Deterministic Business Rules & Duplicate Invoices',
    description: 'Enforces human authorization on transactions > $10,000 USD and detects duplicate invoices.',
  },
];

const Evaluation: React.FC = () => {
  const auth = useContext(AuthContext);
  const [results, setResults] = useState<ScenarioResult[]>([]);
  const [runningAll, setRunningAll] = useState(false);
  const [runningId, setRunningId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const api = axios.create({
    baseURL: '/api',
    headers: { Authorization: `Bearer ${auth?.token}` },
  });

  const runAll = async () => {
    setRunningAll(true);
    setError('');
    setResults([]);
    try {
      const res = await api.post('/evaluation/run-all');
      setResults(res.data.results || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to run all scenarios');
    } finally {
      setRunningAll(false);
    }
  };

  const runSingle = async (id: number) => {
    setRunningId(id);
    setError('');
    try {
      const res = await api.post(`/evaluation/run/${id}`);
      const r = res.data;
      const newResult: ScenarioResult = {
        scenarioId: id,
        passed: r.result?.passed ?? false,
        details: r.result?.details ? JSON.parse(r.result.details) : {},
        tokensUsed: r.result?.tokensUsed,
        costUSD: r.result?.costUSD,
        latencyMs: r.latencyMs,
      };

      setResults((prev) => {
        const filtered = prev.filter((p) => p.scenarioId !== id);
        return [...filtered, newResult].sort((a, b) => a.scenarioId - b.scenarioId);
      });
      setExpandedId(id);
    } catch (err: any) {
      setError(err?.response?.data?.message || `Scenario ${id} execution failed`);
    } finally {
      setRunningId(null);
    }
  };

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  return (
    <div className="flex h-screen bg-[#070b14] text-slate-100 overflow-hidden font-sans">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header */}
        <header className="px-8 py-5 border-b border-slate-800 bg-[#0a0f1d] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
              <FlaskConical className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Evaluation Center
                <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full font-mono">
                  10 Benchmark Scenarios
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Rigorous automated verification of multi-model routing, prompt injection, schemas, RAG, and business rules.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={runAll}
              disabled={runningAll}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/30 transition"
            >
              {runningAll ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
              <span>{runningAll ? 'Running All 10 Tests...' : 'Run All Scenarios'}</span>
            </button>
          </div>
        </header>

        {error && (
          <div className="mx-8 mt-6 p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-8 space-y-6">
          {/* Progress Banner */}
          {results.length > 0 && (
            <div className="bg-[#0e1424] border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-xs text-slate-400 uppercase font-semibold">Tests Executed</span>
                  <div className="text-2xl font-bold text-white font-mono mt-0.5">
                    {results.length} / 10
                  </div>
                </div>
                <div className="h-8 w-px bg-slate-800" />
                <div>
                  <span className="text-xs text-emerald-400 uppercase font-semibold">Passed</span>
                  <div className="text-2xl font-bold text-emerald-400 font-mono mt-0.5">{passedCount}</div>
                </div>
                <div className="h-8 w-px bg-slate-800" />
                <div>
                  <span className="text-xs text-rose-400 uppercase font-semibold">Failed</span>
                  <div className="text-2xl font-bold text-rose-400 font-mono mt-0.5">{failedCount}</div>
                </div>
              </div>

              <div className="text-xs text-slate-400 font-mono">
                Total Latency:{' '}
                <span className="text-indigo-300 font-semibold">
                  {results.reduce((acc, r) => acc + (r.latencyMs || 0), 0)} ms
                </span>{' '}
                • Total Cost:{' '}
                <span className="text-emerald-400 font-semibold">
                  ${results.reduce((acc, r) => acc + (r.costUSD || 0), 0).toFixed(6)}
                </span>
              </div>
            </div>
          )}

          {/* Scenarios List */}
          <div className="space-y-3">
            {SCENARIOS.map((sc) => {
              const res = results.find((r) => r.scenarioId === sc.id);
              const isRunning = runningId === sc.id;
              const isExpanded = expandedId === sc.id;

              return (
                <div
                  key={sc.id}
                  className={`bg-[#0e1424] border rounded-2xl overflow-hidden transition shadow-lg ${
                    res
                      ? res.passed
                        ? 'border-emerald-500/30'
                        : 'border-rose-500/30'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="p-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center font-bold text-xs text-indigo-400 shrink-0 font-mono">
                        {sc.id}
                      </div>

                      <div className="space-y-0.5">
                        <div className="font-bold text-sm text-white flex items-center gap-2">
                          <span>{sc.name}</span>
                          {res && (
                            <span
                              className={`px-2 py-0.5 text-[10px] rounded-full font-bold uppercase ${
                                res.passed
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              {res.passed ? 'PASSED' : 'FAILED'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">{sc.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {res && (
                        <div className="hidden sm:flex items-center gap-4 text-xs font-mono text-slate-400">
                          <span>{res.latencyMs || 0} ms</span>
                          <span>{res.tokensUsed || 0} tok</span>
                          <span className="text-emerald-400">${(res.costUSD || 0).toFixed(6)}</span>
                        </div>
                      )}

                      <button
                        onClick={() => runSingle(sc.id)}
                        disabled={isRunning || runningAll}
                        className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                      >
                        {isRunning ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Play className="w-3.5 h-3.5 text-indigo-400" />
                        )}
                        <span>{isRunning ? 'Running...' : 'Run Test'}</span>
                      </button>

                      {res && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : sc.id)}
                          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                          title="Toggle details"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Result Drawer */}
                  {res && isExpanded && (
                    <div className="px-5 pb-5 pt-2 border-t border-slate-800/80 bg-[#090e1a]/80 space-y-2 text-xs">
                      <div className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                        Execution Details & Assertions:
                      </div>
                      <pre className="p-3 bg-slate-950 rounded-xl text-slate-300 font-mono text-[11px] overflow-x-auto border border-slate-800">
                        {JSON.stringify(res.details || res.error, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Evaluation;
