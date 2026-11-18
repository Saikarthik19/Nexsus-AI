import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import {
  Cpu,
  ShieldAlert,
  CheckCircle,
  XCircle,
  RefreshCw,
  GitBranch,
  Activity,
  Layers,
  CheckSquare,
  AlertTriangle,
  Zap,
} from 'lucide-react';

interface RoutingEvent {
  id: string;
  timestamp: string;
  taskType: string;
  promptSnippet: string;
  primaryModel: string;
  primaryProvider: string;
  routedModel: string;
  routedProvider: string;
  fallbackUsed: boolean;
  fallbackReason?: string;
  tokensUsed: number;
  costUSD: number;
  status: 'success' | 'failed';
}

interface ProviderHealth {
  name: string;
  providerKey: string;
  configured: boolean;
  status: 'online' | 'degraded' | 'offline';
  latencyMs: number;
  activeModel: string;
  models: string[];
  contextWindow: string;
  pricing: string;
  error?: string;
}

interface ApprovalItem {
  _id: string;
  type: string;
  title: string;
  amount?: number;
  details: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected';
  decidedBy?: string;
  decisionReason?: string;
  createdAt: string;
}

interface SecurityEvent {
  id: string;
  type: string;
  severity: string;
  description: string;
  timestamp: string;
}

const AIOperations: React.FC = () => {
  const auth = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState<'routing' | 'providers' | 'approvals' | 'security'>('routing');
  const [providers, setProviders] = useState<ProviderHealth[]>([]);
  const [routingHistory, setRoutingHistory] = useState<RoutingEvent[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  const api = axios.create({
    baseURL: '/api',
    headers: { Authorization: `Bearer ${auth?.token}` },
  });

  const loadData = async () => {
    try {
      setRefreshing(true);
      const [provRes, routeRes, appRes, secRes] = await Promise.all([
        api.get('/operations/providers'),
        api.get('/operations/routing-history'),
        api.get('/operations/approvals'),
        api.get('/operations/security-events'),
      ]);
      setProviders(provRes.data.providers || []);
      setRoutingHistory(routeRes.data.history || []);
      setApprovals(appRes.data.approvals || []);
      setSecurityEvents(secRes.data.events || []);
    } catch (err: any) {
      console.error('Failed to load AI operations data', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [auth?.token]);

  const handleDecision = async (id: string, action: 'approved' | 'rejected') => {
    try {
      const res = await api.post(`/operations/approvals/${id}/decide`, {
        action,
        reason: `Manually ${action} from AI Operations Console`,
      });
      setActionMessage(res.data.message || `Transaction ${action}`);
      setTimeout(() => setActionMessage(''), 4000);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to update approval');
    }
  };

  return (
    <div className="flex h-screen bg-[#070b14] text-slate-100 overflow-hidden font-sans">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header */}
        <header className="px-8 py-5 border-b border-slate-800 bg-[#0a0f1d] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                AI Operations & Orchestration
                <span className="px-2 py-0.5 text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full font-mono">
                  Live Telemetry
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Inspect multi-model routing decisions, provider fallbacks, security policies, and human sign-offs.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={refreshing}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh Telemetry</span>
            </button>
          </div>
        </header>

        {/* Action notification */}
        {actionMessage && (
          <div className="mx-8 mt-4 p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-lg text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Sub-navigation tabs */}
        <div className="px-8 pt-6 pb-2">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <button
              onClick={() => setActiveTab('routing')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                activeTab === 'routing'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <GitBranch className="w-4 h-4" />
              <span>Routing & Fallback Decisions ({routingHistory.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('providers')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                activeTab === 'providers'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Provider Health ({providers.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('approvals')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                activeTab === 'approvals'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              <span>
                Human Approvals (
                {approvals.filter((a) => a.status === 'pending').length} Pending)
              </span>
            </button>

            <button
              onClick={() => setActiveTab('security')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                activeTab === 'security'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Security & Audit Events ({securityEvents.length})</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-8 space-y-6">
          {loading ? (
            <div className="py-20 text-center text-slate-500">Loading AI Operations Telemetry...</div>
          ) : (
            <>
              {/* TAB 1: ROUTING & FALLBACK */}
              {activeTab === 'routing' && (
                <div className="space-y-4">
                  <div className="bg-[#0e1424] border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                    <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-[#11192e]">
                      <div>
                        <h3 className="text-sm font-semibold text-white">Dynamic Model Routing Stream</h3>
                        <p className="text-xs text-slate-400">
                          Automated task-aware router decisions and fallback events across Gemini, Groq, and Mistral AI
                        </p>
                      </div>
                      <span className="text-xs text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-md border border-indigo-500/20">
                        Task Heuristic: Speed / Context / Cost
                      </span>
                    </div>

                    {routingHistory.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 text-xs">
                        No routing events recorded yet. Send a message in AI Chat or run an Evaluation test to view
                        routing logs.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#0b101e] text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
                            <tr>
                              <th className="py-3 px-4">Timestamp</th>
                              <th className="py-3 px-4">Task</th>
                              <th className="py-3 px-4">Prompt Excerpt</th>
                              <th className="py-3 px-4">Primary Target</th>
                              <th className="py-3 px-4">Routed Execution</th>
                              <th className="py-3 px-4">Fallback</th>
                              <th className="py-3 px-4">Tokens / Cost</th>
                              <th className="py-3 px-4">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                            {routingHistory.map((item) => (
                              <tr key={item.id} className="hover:bg-slate-800/30 transition">
                                <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                                  {new Date(item.timestamp).toLocaleTimeString()}
                                </td>
                                <td className="py-3 px-4">
                                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 uppercase text-[10px]">
                                    {item.taskType}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-slate-300 font-sans max-w-xs truncate">
                                  {item.promptSnippet}
                                </td>
                                <td className="py-3 px-4 text-slate-300">{item.primaryModel}</td>
                                <td className="py-3 px-4 text-indigo-300 font-semibold">{item.routedModel}</td>
                                <td className="py-3 px-4">
                                  {item.fallbackUsed ? (
                                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-[10px] font-semibold flex items-center gap-1 w-fit">
                                      <AlertTriangle className="w-3 h-3" />
                                      Fallback Active
                                    </span>
                                  ) : (
                                    <span className="text-emerald-400 text-[10px]">Direct Optimal</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-slate-300">
                                  {item.tokensUsed} tok / ${(item.costUSD || 0).toFixed(6)}
                                </td>
                                <td className="py-3 px-4">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${
                                      item.status === 'success'
                                        ? 'bg-emerald-500/10 text-emerald-400'
                                        : 'bg-rose-500/10 text-rose-400'
                                    }`}
                                  >
                                    {item.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: PROVIDER HEALTH */}
              {activeTab === 'providers' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {providers.map((p) => {
                    const isOnline = p.status === 'online';
                    const isDegraded = p.status === 'degraded';
                    return (
                      <div
                        key={p.providerKey}
                        className="bg-[#0e1424] border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                            <span className="font-bold text-white text-base">{p.name}</span>
                            <span
                              className={`px-2.5 py-1 text-xs rounded-full font-semibold flex items-center gap-1.5 ${
                                isOnline
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : isDegraded
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  isOnline ? 'bg-emerald-400 animate-pulse' : isDegraded ? 'bg-amber-400' : 'bg-rose-400'
                                }`}
                              />
                              {p.status.toUpperCase()}
                            </span>
                          </div>

                          <div className="mt-4 space-y-2.5 text-xs text-slate-300">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Connection Latency:</span>
                              <span className="font-mono text-indigo-300">{p.latencyMs} ms</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Active Model:</span>
                              <span className="font-mono text-white font-medium">{p.activeModel}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Context Window:</span>
                              <span className="font-mono text-slate-300">{p.contextWindow}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Unit Pricing:</span>
                              <span className="font-mono text-slate-300">{p.pricing}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">API Key Configured:</span>
                              <span className="font-semibold text-emerald-400">
                                {p.configured ? 'Verified Server-Side' : 'Missing'}
                              </span>
                            </div>

                            {p.error && (
                              <div className="mt-3 p-2 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] rounded-lg">
                                {p.error}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-5 pt-3 border-t border-slate-800 text-[11px] text-slate-400">
                          Available Models: {p.models.join(', ')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB 3: HUMAN APPROVALS */}
              {activeTab === 'approvals' && (
                <div className="space-y-4">
                  <div className="p-4 bg-indigo-950/20 border border-indigo-800/40 rounded-xl text-xs text-indigo-300 flex items-center gap-3">
                    <ShieldAlert className="w-5 h-5 shrink-0 text-indigo-400" />
                    <span>
                      <strong>Deterministic Business Rule:</strong> Transactions or automated actions exceeding $10,000 USD
                      or classified as sensitive are blocked from automated execution until explicit human authorization
                      is received.
                    </span>
                  </div>

                  <div className="space-y-3">
                    {approvals.map((app) => (
                      <div
                        key={app._id}
                        className="bg-[#0e1424] border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5 max-w-2xl">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">{app.title}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                app.status === 'pending'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : app.status === 'approved'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              }`}
                            >
                              {app.status}
                            </span>
                          </div>

                          <div className="text-xs text-slate-400">
                            Requested Amount:{' '}
                            <span className="font-bold text-emerald-400 font-mono">
                              ${app.amount?.toLocaleString()} USD
                            </span>{' '}
                            • Category: {app.details?.category || 'Financial Operation'}
                          </div>

                          <div className="text-xs text-slate-300 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                            {app.details?.thresholdRule || 'Requires designated manager review'}
                          </div>

                          {app.decisionReason && (
                            <div className="text-[11px] text-slate-400">
                              Decided by: <span className="text-slate-200">{app.decidedBy}</span> ({app.decisionReason})
                            </div>
                          )}
                        </div>

                        {app.status === 'pending' && (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleDecision(app._id, 'approved')}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-lg shadow-emerald-600/20"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Authorize
                            </button>
                            <button
                              onClick={() => handleDecision(app._id, 'rejected')}
                              className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: SECURITY & AUDIT EVENTS */}
              {activeTab === 'security' && (
                <div className="bg-[#0e1424] border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                  <div className="p-4 border-b border-slate-800 bg-[#11192e] flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-white">Security & Audit Event Log</h3>
                      <p className="text-xs text-slate-400">
                        Chronological record of injection attempts, schema enforcement retries, and duplicate transactions
                      </p>
                    </div>
                  </div>

                  {securityEvents.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs">
                      No security incidents logged. All queries and transactions passed normal parameter checks.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-800">
                      {securityEvents.map((evt) => (
                        <div key={evt.id} className="p-4 hover:bg-slate-800/30 transition flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/30 shrink-0 mt-0.5">
                              <ShieldAlert className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-xs text-white">{evt.type}</span>
                                <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 rounded text-[10px] font-bold">
                                  {evt.severity}
                                </span>
                              </div>
                              <p className="text-xs text-slate-300 mt-1">{evt.description}</p>
                            </div>
                          </div>
                          <span className="text-[11px] text-slate-500 font-mono whitespace-nowrap">
                            {new Date(evt.timestamp).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default AIOperations;
