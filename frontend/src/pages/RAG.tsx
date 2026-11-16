import React, { useState, useEffect, useContext, useRef } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import {
  FileText,
  Upload,
  Trash2,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  BookOpen,
  Send,
  Layers,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface DocInfo {
  _id: string;
  originalName: string;
  mimeType: string;
  size: number;
  processingStatus: string;
  chunkCount?: number;
  pageCount?: number;
  createdAt: string;
}

const RAG: React.FC = () => {
  const auth = useContext(AuthContext);
  const [documents, setDocuments] = useState<DocInfo[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>('all');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<any[]>([]);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const api = axios.create({
    baseURL: '/api',
    headers: { Authorization: `Bearer ${auth?.token}` },
  });

  const fetchDocuments = async () => {
    try {
      const res = await api.get('/documents');
      setDocuments(res.data.documents || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchDocuments();
    const interval = setInterval(fetchDocuments, 5000);
    return () => clearInterval(interval);
  }, [auth?.token]);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setUploadError('Please select a PDF or TXT file to upload');
      return;
    }

    setUploading(true);
    setUploadError('');
    setUploadSuccess('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadSuccess(`"${file.name}" uploaded. Processing chunks and embeddings in background.`);
      if (fileRef.current) fileRef.current.value = '';
      fetchDocuments();
    } catch (err: any) {
      setUploadError(err?.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this document and all its indexed chunks?')) return;
    try {
      await api.delete(`/documents/${id}`);
      fetchDocuments();
    } catch (err: any) {
      alert('Failed to delete document');
    }
  };

  const handleAsk = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!question.trim() || asking) return;

    setAsking(true);
    setAskError('');
    setAnswer('');
    setSources([]);

    try {
      const convRes = await api.post('/chat/conversations', { title: `RAG: ${question.slice(0, 25)}` });
      const convId = convRes.data.conversation?._id;

      const payload: any = {
        content: question,
        useRAG: true,
      };
      if (selectedDocId !== 'all') {
        payload.documentId = selectedDocId;
      }

      const msgRes = await api.post(`/chat/conversations/${convId}/messages`, payload);
      const assistantMsg = msgRes.data.assistantMessage || msgRes.data;

      setAnswer(assistantMsg.content || 'No answer generated');
      setSources(msgRes.data.routing?.sources || assistantMsg.metadata?.sources || []);
    } catch (err: any) {
      setAskError(err?.response?.data?.message || 'Failed to retrieve answer from knowledge base.');
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#070b14] text-slate-100 overflow-hidden font-sans">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header */}
        <header className="px-8 py-5 border-b border-slate-800 bg-[#0a0f1d] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Document Intelligence & RAG
                <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full font-mono">
                  Vector Pipeline
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Upload PDFs, extract and clean text, chunk, embed, and query with verified grounded source citations.
              </p>
            </div>
          </div>
        </header>

        <div className="p-8 space-y-8">
          {/* Top Section: Upload Box & Knowledge Base Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Upload Card */}
            <div className="lg:col-span-2 bg-[#0e1424] border border-slate-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
                <Upload className="w-4 h-4 text-purple-400" />
                Upload New Document
              </h2>
              <p className="text-xs text-slate-400 mb-4">
                Supported formats: PDF, TXT, DOCX (Max 25 MB). Files are automatically parsed, chunked, and vectorized.
              </p>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.txt,.docx"
                    className="flex-1 bg-slate-900 text-xs text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-500 rounded-xl border border-slate-700 cursor-pointer"
                  />
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-purple-600/30 transition flex items-center gap-2 shrink-0"
                  >
                    {uploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    <span>{uploading ? 'Processing...' : 'Upload & Vectorize'}</span>
                  </button>
                </div>

                {uploadError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}

                {uploadSuccess && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{uploadSuccess}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Pipeline Status Indicator */}
            <div className="bg-[#0e1424] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">RAG Knowledge Base</span>
                <div className="text-3xl font-extrabold text-white mt-1 font-mono">{documents.length}</div>
                <p className="text-xs text-slate-400 mt-2">
                  Total indexed documents ready for semantic search & retrieval.
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Embedding Model:</span>
                  <span className="font-mono text-purple-300 font-medium">gemini-embedding-001</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Vector Metric:</span>
                  <span className="font-mono text-slate-200">Cosine Similarity</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Chunk Strategy:</span>
                  <span className="font-mono text-slate-200">800 chars / chunk</span>
                </div>
              </div>
            </div>
          </div>

          {/* Middle Section: Document Repository Table */}
          <div className="bg-[#0e1424] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 bg-[#10172a] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-indigo-400" />
                  Indexed Documents
                </h3>
                <p className="text-xs text-slate-400">Manage uploaded sources and inspect chunk vectors</p>
              </div>
              <button
                onClick={fetchDocuments}
                className="text-xs text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
                title="Refresh Documents"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {documents.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No documents uploaded yet. Upload a PDF above to begin grounded Q&A.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#090e1a] text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Filename</th>
                      <th className="py-3 px-4">Size</th>
                      <th className="py-3 px-4">Pages / Chunks</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Uploaded</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {documents.map((d) => (
                      <tr key={d._id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4 font-semibold text-slate-200 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-purple-400 shrink-0" />
                          <span className="truncate max-w-xs">{d.originalName}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 font-mono">{(d.size / 1024).toFixed(1)} KB</td>
                        <td className="py-3 px-4 text-slate-300 font-mono">
                          {d.pageCount || 1} pgs • {d.chunkCount || 0} chunks
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              d.processingStatus === 'ready' || d.processingStatus === 'completed'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : d.processingStatus === 'processing'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {d.processingStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                          {new Date(d.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleDelete(d._id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Bottom Section: Interactive RAG Query Tester */}
          <div className="bg-[#0e1424] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Search className="w-5 h-5 text-indigo-400" />
                Query Grounded Knowledge Base
              </h2>
              <p className="text-xs text-slate-400">
                Ask questions against your uploaded PDFs. The engine retrieves relevant vector chunks, constructs augmented
                context, and returns a verified answer with source references.
              </p>
            </div>

            <form onSubmit={handleAsk} className="space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400 font-medium">Filter Source:</span>
                  <select
                    value={selectedDocId}
                    onChange={(e) => setSelectedDocId(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-lg focus:outline-none focus:border-indigo-500 font-medium"
                  >
                    <option value="all">All Indexed Documents</option>
                    {documents.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.originalName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-3 focus-within:border-indigo-500 transition">
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="e.g. What is the requirement for high-value transactions exceeding 10000 USD?"
                    className="w-full bg-transparent text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!question.trim() || asking}
                  className="px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition shrink-0"
                >
                  {asking ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>{asking ? 'Retrieving...' : 'Ask Question'}</span>
                </button>
              </div>
            </form>

            {askError && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>{askError}</span>
              </div>
            )}

            {answer && (
              <div className="p-6 bg-[#11192e] border border-indigo-500/30 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="font-bold text-sm text-indigo-300 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" /> Grounded RAG Answer
                  </span>
                  <span className="text-[11px] text-emerald-400 font-medium">✓ Citations Grounded</span>
                </div>

                <div className="text-xs text-slate-200 leading-relaxed prose prose-invert prose-xs max-w-none">
                  <ReactMarkdown>{answer}</ReactMarkdown>
                </div>

                {sources.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Source References & Chunks
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {sources.map((s, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-slate-900/80 rounded-xl border border-purple-500/20 text-xs space-y-1"
                        >
                          <div className="font-semibold text-purple-300 flex justify-between">
                            <span>{s.documentName}</span>
                            <span className="font-mono text-[10px] text-slate-400">Page {s.page || 1}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 line-clamp-3">{s.snippet}</div>
                          <div className="text-[10px] text-indigo-400 font-mono">Similarity: {s.similarity}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default RAG;
