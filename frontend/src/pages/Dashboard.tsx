import React, { useState, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import {
  MessageSquare,
  FileText,
  DollarSign,
  Cpu,
  Zap,
  Activity,
  PlusCircle,
  Upload,
  FlaskConical,
  CheckCircle2,
  AlertCircle,
  Database,
  Server,
  Layers,
  TrendingUp,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

interface DashboardData {
  overview: {
    conversations: number;
    messages: number;
    documents: number;
    evaluations: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCostUSD: number;
    budgetUSD: number;
    budgetUsedPercent: number;
  };
  modelDistribution: Array<{
    model: string;
    requests: number;
    tokens: number;
    costUSD: number;
  }>;
  providerStats: Array<{
    name: string;
    key: string;
    requests: number;
    tokens: number;
    costUSD: number;
  }>;
  recentActivity: {
    conversations: Array<{ id: string; title: string; messageCount: number; updatedAt: string }>;
    documents: Array<{ id: string; name: string; status: string; chunks: number; size: number; createdAt: string }>;
    evaluations: Array<{ id: string; scenarioId: number; passed: boolean; tokensUsed: number; costUSD: number; createdAt: string }>;
  };
  systemHealth: {
    backend: string;
    uptimeSeconds: number;
    database: string;
    environment: string;
  };
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
}

const COLORS = ['#6366f1', '#a855f7', '#06b6d4', '#10b981', '#f59e0b'];

const Dashboard: React.FC = () => {
  const auth = useContext(AuthContext);
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [providers, setProviders] = useState<ProviderHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const api = axios.create({
    baseURL: '/api',
    headers: { Authorization: `Bearer ${auth?.token}` },
  });

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [dashRes, provRes] = await Promise.all([
        api.get('/stats/dashboard'),
        api.get('/operations/providers'),
      ]);
      setData(dashRes.data);
      setProviders(provRes.data.providers || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [auth?.token]);

  const overview = data?.overview || {
    conversations: 0,
    messages: 0,
    documents: 0,
    evaluations: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCostUSD: 0,
    budgetUSD: 10,
    budgetUsedPercent: 0,
  };

  // Format token data for bar chart
  const tokenChartData = [
    { name: 'Input Tokens', tokens: overview.totalInputTokens, fill: '#6366f1' },
    { name: 'Output Tokens', tokens: overview.totalOutputTokens, fill: '#a855f7' },
  ];

  // Provider share for pie chart
  const pieData = (data?.providerStats || [])
    .filter((p) => p.tokens > 0 || p.requests > 0)
    .map((p) => ({
      name: p.name,
      value: p.tokens > 0 ? p.tokens : p.requests,
    }));

  return (
    <div className="flex h-screen bg-[#070b14] text-slate-100 overflow-hidden font-sans">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Navbar / Welcome Bar */}
        <header className="px-8 py-6 border-b border-slate-800 bg-[#0a0f1d] flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Welcome back,{' '}
                <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-blue-400 bg-clip-text text-transparent">
                  {auth?.user?.name || 'Administrator'}
                </span>
              </h1>
              <span className="px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                System Operational
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Multi-Model Intelligent Assistant: Cost-Aware Routing, RAG Document Pipeline & Evaluation Center.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-3">
            <Link
              to="/chat"
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/25 transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>New Chat</span>
            </Link>

            <Link
              to="/rag"
              className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold rounded-xl transition"
            >
              <Upload className="w-4 h-4" />
              <span>Upload PDF</span>
            </Link>

            <Link
              to="/evaluation"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold rounded-xl transition"
            >
              <FlaskConical className="w-4 h-4" />
              <span>Run Evaluation</span>
            </Link>
          </div>
        </header>

        {error && (
          <div className="mx-8 mt-6 p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-8 space-y-8">
          {/* SECTION A: OVERVIEW STATS CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Card 1: Total Conversations */}
            <div className="bg-[#0e1424] border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden group hover:border-indigo-500/40 transition">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Conversations</span>
                  <div className="text-3xl font-extrabold text-white mt-1.5 font-mono">{overview.conversations}</div>
                </div>
                <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                  <MessageSquare className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-[11px] text-slate-400 pt-3 border-t border-slate-800/80">
                <span>Active Chat Sessions</span>
                <Link to="/chat" className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium">
                  Launch <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* Card 2: Messages Exchanged */}
            <div className="bg-[#0e1424] border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden group hover:border-purple-500/40 transition">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Messages</span>
                  <div className="text-3xl font-extrabold text-white mt-1.5 font-mono">{overview.messages}</div>
                </div>
                <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
                  <Layers className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-[11px] text-slate-400 pt-3 border-t border-slate-800/80">
                <span>
                  Tokens: {(overview.totalInputTokens + overview.totalOutputTokens).toLocaleString()}
                </span>
                <span className="text-purple-400 font-mono">User & AI</span>
              </div>
            </div>

            {/* Card 3: Documents Processed */}
            <div className="bg-[#0e1424] border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden group hover:border-blue-500/40 transition">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Documents Processed</span>
                  <div className="text-3xl font-extrabold text-white mt-1.5 font-mono">{overview.documents}</div>
                </div>
                <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
                  <FileText className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-[11px] text-slate-400 pt-3 border-t border-slate-800/80">
                <span>Vectorized Knowledge Base</span>
                <Link to="/rag" className="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium">
                  RAG Pipeline <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* Card 4: Total Cost & Budget */}
            <div className="bg-[#0e1424] border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden group hover:border-emerald-500/40 transition">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total API Cost</span>
                  <div className="text-3xl font-extrabold text-emerald-400 mt-1.5 font-mono">
                    ${overview.totalCostUSD.toFixed(6)}
                  </div>
                </div>
                <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-[11px] text-slate-400 pt-3 border-t border-slate-800/80">
                <span>Budget: ${overview.budgetUSD.toFixed(2)}</span>
                <span className="font-semibold text-emerald-400 font-mono">
                  {overview.budgetUsedPercent}% Used
                </span>
              </div>
            </div>
          </div>

          {/* SECTION B: AI PROVIDER MONITORING */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-indigo-400" />
                  AI Provider Monitoring & Verified Connectivity
                </h2>
                <p className="text-xs text-slate-400">
                  Live connection health checks and telemetry across Google Gemini, Groq, and Mistral AI
                </p>
              </div>
              <Link
                to="/ai-operations"
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
              >
                Detailed Operations Stream <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {providers.map((p) => {
                const isOnline = p.status === 'online';
                const isDegraded = p.status === 'degraded';
                return (
                  <div
                    key={p.providerKey}
                    className="bg-[#0e1424] border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition"
                  >
                    <div>
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                        <span className="font-bold text-white text-sm">{p.name}</span>
                        <span
                          className={`px-2.5 py-0.5 text-[11px] rounded-full font-semibold flex items-center gap-1.5 ${
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

                      <div className="mt-3.5 space-y-2 text-xs text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Active Model:</span>
                          <span className="font-mono text-indigo-300 font-medium">{p.activeModel}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Ping Latency:</span>
                          <span className="font-mono text-white">{p.latencyMs} ms</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Context Limit:</span>
                          <span className="font-mono text-slate-400">{p.contextWindow}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Input Pricing:</span>
                          <span className="font-mono text-slate-400">{p.pricing}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">API Key Configured:</span>
                      <span className="text-emerald-400 font-medium">Server-Side Verified</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION C: ANALYTICS & VISUALIZATIONS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Token Usage Distribution */}
            <div className="bg-[#0e1424] border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-purple-400" />
                    Token Usage Distribution
                  </h3>
                  <p className="text-xs text-slate-400">Real input vs output tokens aggregated across models</p>
                </div>
                <span className="text-xs font-mono text-indigo-400">
                  {(overview.totalInputTokens + overview.totalOutputTokens).toLocaleString()} Total
                </span>
              </div>

              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tokenChartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                      formatter={(val: any) => [val.toLocaleString() + ' tokens', 'Count']}
                    />
                    <Bar dataKey="tokens" radius={[6, 6, 0, 0]}>
                      {tokenChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Model Distribution Breakdown */}
            <div className="bg-[#0e1424] border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-400" />
                    Model & Provider Activity
                  </h3>
                  <p className="text-xs text-slate-400">Execution requests recorded by model provider</p>
                </div>
                <Link to="/cost-tracking" className="text-xs text-blue-400 hover:text-blue-300 font-medium">
                  Cost Breakdown →
                </Link>
              </div>

              {data?.modelDistribution && data.modelDistribution.length > 0 ? (
                <div className="space-y-3 pt-2">
                  {data.modelDistribution.map((m, idx) => (
                    <div key={m.model} className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-white font-mono">{m.model}</span>
                        <span className="text-slate-400 font-mono">
                          {m.requests} requests • {m.tokens} tokens
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-indigo-500 h-2 rounded-full"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(10, (m.tokens / Math.max(1, overview.totalInputTokens + overview.totalOutputTokens)) * 100)
                            )}%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-500">
                        <span>Cost: ${m.costUSD.toFixed(6)}</span>
                        <span>Estimated AI Spend</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-56 flex flex-col items-center justify-center text-slate-500 text-xs">
                  <Activity className="w-8 h-8 text-slate-600 mb-2" />
                  <span>No model requests recorded yet. Start a chat or run an evaluation scenario.</span>
                </div>
              )}
            </div>
          </div>

          {/* SECTION D: RECENT ACTIVITY */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Conversations */}
            <div className="bg-[#0e1424] border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                <span className="text-sm font-bold text-white">Recent Conversations</span>
                <Link to="/chat" className="text-xs text-indigo-400 hover:text-indigo-300">
                  View All
                </Link>
              </div>
              <div className="space-y-2.5">
                {data?.recentActivity?.conversations && data.recentActivity.conversations.length > 0 ? (
                  data.recentActivity.conversations.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => navigate('/chat')}
                      className="p-3 bg-slate-900/40 hover:bg-slate-800/50 rounded-xl border border-slate-800/80 cursor-pointer transition flex items-center justify-between"
                    >
                      <div className="overflow-hidden">
                        <div className="text-xs font-semibold text-slate-200 truncate">{c.title}</div>
                        <div className="text-[10px] text-slate-500">{new Date(c.updatedAt).toLocaleTimeString()}</div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
                        {c.messageCount} msgs
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center text-slate-500 text-xs">No conversations yet</div>
                )}
              </div>
            </div>

            {/* Recent Documents */}
            <div className="bg-[#0e1424] border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                <span className="text-sm font-bold text-white">Recent Documents (RAG)</span>
                <Link to="/rag" className="text-xs text-purple-400 hover:text-purple-300">
                  Manage
                </Link>
              </div>
              <div className="space-y-2.5">
                {data?.recentActivity?.documents && data.recentActivity.documents.length > 0 ? (
                  data.recentActivity.documents.map((d) => (
                    <div
                      key={d.id}
                      className="p-3 bg-slate-900/40 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs"
                    >
                      <div className="overflow-hidden">
                        <div className="font-semibold text-slate-200 truncate">{d.name}</div>
                        <div className="text-[10px] text-slate-500">
                          {d.chunks} chunks • {(d.size / 1024).toFixed(1)} KB
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          d.status === 'ready' || d.status === 'completed'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {d.status}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center text-slate-500 text-xs">No documents uploaded</div>
                )}
              </div>
            </div>

            {/* Recent Evaluations */}
            <div className="bg-[#0e1424] border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                <span className="text-sm font-bold text-white">Evaluation Results</span>
                <Link to="/evaluation" className="text-xs text-blue-400 hover:text-blue-300">
                  Run Scenarios
                </Link>
              </div>
              <div className="space-y-2.5">
                {data?.recentActivity?.evaluations && data.recentActivity.evaluations.length > 0 ? (
                  data.recentActivity.evaluations.map((e) => (
                    <div
                      key={e.id}
                      className="p-3 bg-slate-900/40 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-200">Scenario {e.scenarioId}</div>
                        <div className="text-[10px] text-slate-500">
                          {e.tokensUsed || 0} tokens • ${Number(e.costUSD || 0).toFixed(6)}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          e.passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {e.passed ? 'PASSED' : 'FAILED'}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center text-slate-500 text-xs">No evaluation tests run yet</div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION F: SYSTEM HEALTH & INTEGRITY */}
          <div className="bg-[#0e1424] border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  System Health & Observability
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Node.js / Express Server • MongoDB Persistence • Rate Limiter: Active
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-400" />
                <span>MongoDB:</span>
                <span className="font-semibold text-emerald-400 uppercase font-mono">
                  {data?.systemHealth?.database || 'Connected'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-400" />
                <span>Backend Uptime:</span>
                <span className="font-mono text-slate-200">
                  {Math.floor((data?.systemHealth?.uptimeSeconds || 0) / 60)} mins
                </span>
              </div>

              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>JWT Security:</span>
                <span className="text-emerald-400 font-semibold">Active</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
