import React, { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import { Settings as SettingsIcon, User, Shield, Cpu, Key, Database, Server } from 'lucide-react';

const Settings: React.FC = () => {
  const auth = useContext(AuthContext);

  return (
    <div className="flex h-screen bg-[#070b14] text-slate-100 overflow-hidden font-sans">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="px-8 py-5 border-b border-slate-800 bg-[#0a0f1d] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200">
              <SettingsIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">System & Account Settings</h1>
              <p className="text-xs text-slate-400">View configuration, security policies, and system topology.</p>
            </div>
          </div>
        </header>

        <div className="p-8 max-w-4xl space-y-6">
          {/* User Account */}
          <div className="bg-[#0e1424] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-400" />
              Authenticated User Profile
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                <span className="text-slate-400">Full Name:</span>
                <p className="font-semibold text-white mt-1">{auth?.user?.name || 'Nexus Admin'}</p>
              </div>
              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                <span className="text-slate-400">Email Address:</span>
                <p className="font-semibold text-white mt-1">{auth?.user?.email || 'demo@nexusai.io'}</p>
              </div>
              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                <span className="text-slate-400">Security Clearance:</span>
                <p className="font-semibold text-emerald-400 mt-1 capitalize">{auth?.user?.role || 'Administrator'}</p>
              </div>
            </div>
          </div>

          {/* AI Providers Config */}
          <div className="bg-[#0e1424] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-purple-400" />
              Integrated AI Providers
            </h2>
            <div className="space-y-3 text-xs">
              <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white">Google Gemini</div>
                  <div className="text-slate-400 text-[11px]">gemini-3.5-flash-lite, gemini-embedding-001</div>
                </div>
                <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full font-semibold text-[10px]">
                  ACTIVE & CONNECTED
                </span>
              </div>

              <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white">Groq Cloud Inference</div>
                  <div className="text-slate-400 text-[11px]">qwen/qwen3.8-27b, openai/gpt-oss-20b</div>
                </div>
                <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full font-semibold text-[10px]">
                  ACTIVE & CONNECTED
                </span>
              </div>

              <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white">OpenAI</div>
                  <div className="text-slate-400 text-[11px]">gpt-4o-mini, text-embedding-3-small</div>
                </div>
                <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full font-semibold text-[10px]">
                  FALLBACK ACTIVE
                </span>
              </div>
            </div>
          </div>

          {/* System & Architecture */}
          <div className="bg-[#0e1424] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-400" />
              Project Architecture Specifications
            </h2>
            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex justify-between p-2.5 bg-slate-900/40 rounded-lg">
                <span className="text-slate-400">Platform Architecture:</span>
                <span className="font-semibold text-white">NexusAI Enterprise Multi-Model Intelligence Platform</span>
              </div>
              <div className="flex justify-between p-2.5 bg-slate-900/40 rounded-lg">
                <span className="text-slate-400">Frontend Stack:</span>
                <span className="font-mono text-indigo-300">React 18 + Vite + TypeScript + TailwindCSS</span>
              </div>
              <div className="flex justify-between p-2.5 bg-slate-900/40 rounded-lg">
                <span className="text-slate-400">Backend Stack:</span>
                <span className="font-mono text-purple-300">Node.js + Express + TypeScript + Mongoose</span>
              </div>
              <div className="flex justify-between p-2.5 bg-slate-900/40 rounded-lg">
                <span className="text-slate-400">Database Engine:</span>
                <span className="font-mono text-emerald-300">MongoDB (Atlas / Memory Server)</span>
              </div>
              <div className="flex justify-between p-2.5 bg-slate-900/40 rounded-lg">
                <span className="text-slate-400">Security Model:</span>
                <span className="font-mono text-slate-300">JWT Token in Authorization Header + Helmet + Rate Limiter</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Settings;
