import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import {
  Coins,
  TrendingUp,
  AlertCircle,
  DollarSign,
  Activity,
  Layers,
  PieChart as PieIcon,
  CheckCircle2,
  RefreshCw,
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

interface CostStats {
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
}

const COLORS = ['#6366f1', '#a855f7', '#06b6d4', '#10b981', '#f59e0b'];

const CostTracking: React.FC = () => {
  const auth = useContext(AuthContext);
  const [data, setData] = useState<CostStats | null>(null);
  const [newBudget, setNewBudget] = useState('10.00');
  const [budgetSuccess, setBudgetSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const api = axios.create({
    baseURL: '/api',
    headers: { Authorization: `Bearer ${auth?.token}` },
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/stats/dashboard');
      setData(res.data);
      if (res.data?.overview?.budgetUSD) {
        setNewBudget(String(res.data.overview.budgetUSD));
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to fetch cost analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [auth?.token]);

  const handleUpdateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(newBudget);
    if (isNaN(val) || val <= 0) {
      alert('Please enter a valid positive dollar budget amount');
      return;
    }
    try {
      await api.post('/stats/budget', { budgetUSD: val });
      setBudgetSuccess(`Monthly budget ceiling updated to $${val.toFixed(2)} USD`);
      setTimeout(() => setBudgetSuccess(''), 4000);
      fetchData();
    } catch (err: any) {
      alert('Failed to update budget limit');
    }
  };

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

  const tokenBarData = [
    { name: 'Input Tokens', tokens: overview.totalInputTokens, fill: '#6366f1' },
    { name: 'Output Tokens', tokens: overview.totalOutputTokens, fill: '#a855f7' },
  ];

  const pieData = (data?.providerStats || [])
    .filter((p) => p.tokens > 0 || p.costUSD > 0 || p.requests > 0)
    .map((p) => ({
      name: p.name,
      value: p.tokens > 0 ? p.tokens : p.requests,
      cost: p.costUSD,
    }));

  return (
    <div className="flex h-screen bg-[#070b14] text-slate-100 overflow-hidden font-sans">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header */}
        <header className="px-8 py-5 border-b border-slate-800 bg-[#0a0f1d] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Cost Analytics & Budget Management
                <span className="px-2 py-0.5 text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full font-mono">
                  Real Financial Telemetry
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Track input/output tokens, per-provider financial expenditure, and set enforceable budget limits.
              </p>
            </div>
          </div>

          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </header>

        {error && (
          <div className="mx-8 mt-6 p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-8 space-y-8">
          {/* Top Banner: Total Spend & Budget Progress */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#0e1424] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Total Estimated AI Spend
                </span>
                <div className="text-4xl font-extrabold text-emerald-400 mt-2 font-mono">
                  ${overview.totalCostUSD.toFixed(6)}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Aggregated across Google Gemini, Groq Cloud, and Mistral AI calls.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-500 font-mono">
                No simulated or fabricated financial data
              </div>
            </div>

            <div className="bg-[#0e1424] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Monthly Budget Ceiling</span>
                <div className="text-4xl font-extrabold text-white mt-2 font-mono">${overview.budgetUSD.toFixed(2)}</div>
                <div className="mt-3 space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Budget Consumed:</span>
                    <span className="font-semibold text-emerald-400 font-mono">{overview.budgetUsedPercent}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-2.5 rounded-full transition-all duration-500 ${
                        overview.budgetUsedPercent > 80 ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(1, overview.budgetUsedPercent))}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-500">
                Rule: Warns and blocks queries exceeding threshold
              </div>
            </div>

            {/* Set Budget Form */}
            <div className="bg-[#0e1424] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Update Budget Ceiling
                </span>
                <form onSubmit={handleUpdateBudget} className="mt-3 space-y-3">
                  <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    <input
                      type="number"
                      step="0.50"
                      min="1"
                      value={newBudget}
                      onChange={(e) => setNewBudget(e.target.value)}
                      className="bg-transparent text-xs text-white font-mono w-full focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition shadow-md shadow-indigo-600/30"
                  >
                    Save Limit
                  </button>
                </form>
              </div>

              {budgetSuccess && (
                <div className="text-[11px] text-emerald-400 mt-2 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{budgetSuccess}</span>
                </div>
              )}
            </div>
          </div>

          {/* Visual Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Token Distribution */}
            <div className="bg-[#0e1424] border border-slate-800 rounded-2xl p-6 shadow-xl">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
                <Activity className="w-4 h-4 text-purple-400" />
                Aggregated Token Consumption
              </h3>
              <p className="text-xs text-slate-400 mb-4">Input Prompt Tokens vs Assistant Output Tokens</p>

              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tokenBarData}>
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                      formatter={(val: any) => [val.toLocaleString() + ' tokens', 'Volume']}
                    />
                    <Bar dataKey="tokens" radius={[6, 6, 0, 0]}>
                      {tokenBarData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Provider Breakdown */}
            <div className="bg-[#0e1424] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
                  <Layers className="w-4 h-4 text-blue-400" />
                  Provider Breakdown & Unit Pricing
                </h3>
                <p className="text-xs text-slate-400 mb-4">Pricing structure per 1 Million tokens</p>

                <div className="space-y-3">
                  <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-white">Google Gemini 3.5 Flash Lite</div>
                      <div className="text-[11px] text-slate-400">$0.075 / 1M in • $0.30 / 1M out</div>
                    </div>
                    <span className="font-mono text-indigo-300 font-semibold">Tier 1 Fast/Cheap</span>
                  </div>

                  <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-white">Groq Cloud (Qwen 27B / GPT-OSS)</div>
                      <div className="text-[11px] text-slate-400">$0.05 / 1M in • $0.08 / 1M out</div>
                    </div>
                    <span className="font-mono text-purple-300 font-semibold">Tier 2 Ultra-Fast</span>
                  </div>

                  <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-white">Mistral AI (ministral-8b-latest)</div>
                      <div className="text-[11px] text-slate-400">$0.10 / 1M in • $0.10 / 1M out</div>
                    </div>
                    <span className="font-mono text-amber-300 font-semibold">Tier 3 Reasoning</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CostTracking;
