import React, { useState, useEffect, useContext, useRef } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import {
  MessageSquare,
  Plus,
  Send,
  Trash2,
  Cpu,
  FileText,
  Bot,
  User,
  Sparkles,
  Zap,
  Info,
  ChevronDown,
  Layers,
  AlertTriangle,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Conversation {
  _id: string;
  title: string;
  messageCount: number;
  updatedAt: string;
}

interface Message {
  _id?: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCost?: number;
  metadata?: {
    sources?: Array<{ documentName: string; page?: number; similarity?: number; snippet?: string }>;
    fallbackUsed?: boolean;
    fallbackReason?: string;
    provider?: string;
    routingMode?: string;
    routingReason?: string;
    taskCategory?: string;
    injectionDetected?: boolean;
  };
  createdAt?: string;
}

const AVAILABLE_MODELS = [
  { id: 'auto', name: 'Auto (Task-Aware Routing: Speed/Context/Cost)', provider: 'Router' },
  { id: 'gemini-3.5-flash-lite', name: 'Google Gemini 3.5 Flash Lite (Fast & Cheap)', provider: 'Gemini' },
  { id: 'qwen/qwen3.8-27b', name: 'Groq Cloud (Qwen 27B Fast Inference)', provider: 'Groq' },
  { id: 'ministral-8b-latest', name: 'Mistral AI (Ministral 8B Reasoning & Analysis)', provider: 'Mistral' },
];

const Chat: React.FC = () => {
  const auth = useContext(AuthContext);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputContent, setInputContent] = useState('');
  const [selectedModel, setSelectedModel] = useState('auto');
  const [useRAG, setUseRAG] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const api = axios.create({
    baseURL: '/api',
    headers: { Authorization: `Bearer ${auth?.token}` },
  });

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const res = await api.get('/chat/conversations');
      const convs = res.data.conversations || [];
      setConversations(convs);
      if (convs.length > 0 && !activeConvId) {
        setActiveConvId(convs[0]._id);
      }
    } catch (err: any) {
      console.error('Failed to fetch conversations', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (convId: string) => {
    try {
      const res = await api.get(`/chat/conversations/${convId}/messages`);
      setMessages(res.data.messages || []);
    } catch (err: any) {
      console.error('Failed to load messages', err);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [auth?.token]);

  useEffect(() => {
    if (activeConvId) {
      fetchMessages(activeConvId);
    } else {
      setMessages([]);
    }
  }, [activeConvId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const handleNewConversation = async () => {
    try {
      const res = await api.post('/chat/conversations', { title: 'New Conversation' });
      const newConv = res.data.conversation;
      setConversations([newConv, ...conversations]);
      setActiveConvId(newConv._id);
      setMessages([]);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to create conversation');
    }
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this conversation?')) return;
    try {
      await api.delete(`/chat/conversations/${id}`);
      const remaining = conversations.filter((c) => c._id !== id);
      setConversations(remaining);
      if (activeConvId === id) {
        setActiveConvId(remaining.length > 0 ? remaining[0]._id : null);
      }
    } catch (err: any) {
      alert('Failed to delete conversation');
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputContent.trim() || sending) return;

    let targetConvId = activeConvId;
    if (!targetConvId) {
      try {
        const convRes = await api.post('/chat/conversations', { title: inputContent.slice(0, 30) });
        targetConvId = convRes.data.conversation._id;
        setActiveConvId(targetConvId);
        setConversations([convRes.data.conversation, ...conversations]);
      } catch (err) {
        alert('Could not start conversation');
        return;
      }
    }

    const userText = inputContent.trim();
    setInputContent('');

    // Optimistic UI user message
    const tempUserMsg: Message = {
      role: 'user',
      content: userText,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setSending(true);

    try {
      const res = await api.post(`/chat/conversations/${targetConvId}/messages`, {
        content: userText,
        model: selectedModel,
        useRAG,
      });

      const { assistantMessage } = res.data;
      setMessages((prev) => [...prev.slice(0, -1), res.data.userMessage, assistantMessage]);
      fetchConversations(); // refresh title & count
    } catch (err: any) {
      const errorMsg: Message = {
        role: 'assistant',
        content: `Error: ${err?.response?.data?.message || 'Failed to get response from AI provider.'}`,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#070b14] text-slate-100 overflow-hidden font-sans">
      <Sidebar />

      {/* Main Chat Layout: Sessions Sidebar + Chat View */}
      <div className="flex-1 flex min-w-0">
        {/* Inner Sidebar: Conversations List */}
        <div className="w-72 bg-[#090e1a] border-r border-slate-800 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <span className="font-bold text-sm text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              Chat Sessions
            </span>
            <button
              onClick={handleNewConversation}
              className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition"
              title="New Chat"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {conversations.map((c) => {
              const isActive = c._id === activeConvId;
              return (
                <div
                  key={c._id}
                  onClick={() => setActiveConvId(c._id)}
                  className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition text-xs ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-900/60 to-purple-900/40 border border-indigo-500/40 text-white font-medium shadow-md'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                    <span className="truncate">{c.title || 'Untitled Conversation'}</span>
                  </div>
                  <button
                    onClick={(e) => handleDeleteConversation(c._id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 transition"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}

            {conversations.length === 0 && !loading && (
              <div className="py-12 text-center text-slate-500 text-xs">No active chats. Click + to begin.</div>
            )}
          </div>
        </div>

        {/* Chat Main View */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#070b14]">
          {/* Chat Toolbar Controls */}
          <div className="h-16 border-b border-slate-800 px-6 flex items-center justify-between bg-[#0a0f1d] shrink-0 gap-4">
            {/* Model Selector */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                Model:
              </span>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-slate-900 text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
              >
                {AVAILABLE_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            {/* RAG Toggle */}
            <label className="flex items-center gap-2.5 cursor-pointer text-xs select-none">
              <input
                type="checkbox"
                checked={useRAG}
                onChange={(e) => setUseRAG(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-slate-700"
              />
              <span className={`font-semibold flex items-center gap-1.5 ${useRAG ? 'text-purple-400' : 'text-slate-400'}`}>
                <FileText className="w-3.5 h-3.5" />
                RAG Document Knowledge
              </span>
            </label>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 max-w-lg mx-auto">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-500/20 mb-4">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">NexusAI Multi-Model Assistant</h3>
                <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                  Select a provider model or leave on Auto for dynamic task-aware routing. Check "RAG Document Knowledge"
                  to ground answers in your uploaded PDFs.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left">
                  <button
                    onClick={() => {
                      setInputContent('Summarize the multi-model architecture of NexusAI.');
                    }}
                    className="p-3 bg-slate-900/60 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs text-slate-300 transition"
                  >
                    💡 "Summarize multi-model architecture"
                  </button>
                  <button
                    onClick={() => {
                      setUseRAG(true);
                      setInputContent('What are the refund guarantee policies in the uploaded document?');
                    }}
                    className="p-3 bg-slate-900/60 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs text-slate-300 transition"
                  >
                    📄 "Query uploaded PDF via RAG"
                  </button>
                </div>
              </div>
            )}

            {messages.map((m, idx) => {
              const isUser = m.role === 'user';
              return (
                <div key={idx} className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
                  {!isUser && (
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shrink-0 shadow-md">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  )}

                  <div className={`max-w-2xl space-y-2`}>
                    <div
                      className={`p-4 rounded-2xl text-xs leading-relaxed shadow-lg ${
                        isUser
                          ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-tr-none'
                          : 'bg-[#0f172a] border border-slate-800 text-slate-200 rounded-tl-none'
                      }`}
                    >
                      <div className="prose prose-invert prose-xs max-w-none">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>

                      {/* RAG Source Citations Drawer */}
                      {m.metadata?.sources && m.metadata.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1.5">
                          <span className="text-[10px] uppercase font-bold text-purple-400 flex items-center gap-1">
                            <FileText className="w-3 h-3" /> Grounded RAG Sources:
                          </span>
                          <div className="grid grid-cols-1 gap-1.5">
                            {m.metadata.sources.map((s, sIdx) => (
                              <div
                                key={sIdx}
                                className="p-2 bg-slate-950/60 rounded-lg border border-purple-500/20 text-[11px] text-slate-300"
                              >
                                <div className="font-semibold text-purple-300">
                                  {s.documentName} (Page {s.page || 1}) • Similarity: {s.similarity}
                                </div>
                                <div className="text-slate-400 text-[10px] mt-0.5 italic">{s.snippet}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Metadata Footer with Dynamic Multi-Provider Routing & Telemetry */}
                    {!isUser && m.model && (
                      <div className="space-y-1.5 px-2 pt-1">
                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 font-mono">
                          {/* Provider Badge */}
                          {(m.metadata?.provider === 'groq' || m.model.toLowerCase().includes('qwen') || m.model.toLowerCase().includes('groq')) ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-900/50 text-purple-300 border border-purple-500/40 font-sans font-bold shadow-sm">
                              <Zap className="w-2.5 h-2.5 text-purple-400" /> Groq Cloud
                            </span>
                          ) : (m.metadata?.provider === 'mistral' || m.model.toLowerCase().includes('mistral') || m.metadata?.provider === 'openai' || m.model.toLowerCase().includes('gpt')) ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-900/50 text-amber-300 border border-amber-500/40 font-sans font-bold shadow-sm">
                              <Cpu className="w-2.5 h-2.5 text-amber-400" /> Mistral AI
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-300 border border-blue-500/40 font-sans font-bold shadow-sm">
                              <Sparkles className="w-2.5 h-2.5 text-blue-400" /> Google Gemini
                            </span>
                          )}

                          {/* Routing Mode */}
                          {m.metadata?.routingMode === 'auto' ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[9px] font-sans font-medium">
                              <Layers className="w-2.5 h-2.5" /> Auto-Routed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 text-[9px] font-sans">
                              Manual
                            </span>
                          )}

                          {/* Model Identifier */}
                          <span className="text-slate-300 font-semibold">{m.model}</span>
                          <span>•</span>

                          {/* Token Usage */}
                          <span>
                            {m.inputTokens || 0} in / {m.outputTokens || 0} out
                          </span>
                          <span>•</span>

                          {/* Cost */}
                          <span className="text-emerald-400 font-semibold">${Number(m.estimatedCost || 0).toFixed(6)}</span>
                        </div>

                        {/* Routing Reason Pill */}
                        {m.metadata?.routingReason && (
                          <div className="text-[10px] text-slate-400 flex items-center gap-1.5 bg-slate-900/40 border border-slate-800/80 px-2 py-1 rounded-lg">
                            <Info className="w-3 h-3 text-indigo-400 shrink-0" />
                            <span className="truncate">{m.metadata.routingReason}</span>
                          </div>
                        )}

                        {/* Fallback Warning Alert */}
                        {m.metadata?.fallbackUsed && (
                          <div className="text-[10px] text-amber-300 bg-amber-950/40 border border-amber-500/30 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                            <span>Fallback engaged: {m.metadata.fallbackReason || 'Primary provider was unavailable'}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {isUser && (
                    <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-slate-300" />
                    </div>
                  )}
                </div>
              );
            })}

            {sending && (
              <div className="flex gap-4 items-center">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shrink-0 animate-pulse">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="px-4 py-3 bg-[#0f172a] border border-slate-800 rounded-2xl text-xs text-slate-400 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                  <span>NexusAI is orchestrating response...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Bar */}
          <div className="p-4 border-t border-slate-800 bg-[#090e1a]">
            <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex items-end gap-3">
              <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-2.5 focus-within:border-indigo-500 transition">
                <textarea
                  rows={2}
                  value={inputContent}
                  onChange={(e) => setInputContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Ask NexusAI anything... (Shift+Enter for newline)"
                  className="w-full bg-transparent text-xs text-slate-100 placeholder-slate-500 resize-none focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={!inputContent.trim() || sending}
                className="h-11 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition shrink-0"
              >
                <Send className="w-4 h-4" />
                <span>Send</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
