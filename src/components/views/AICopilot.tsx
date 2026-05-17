import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Code,
  Copy,
  Download,
  HardDrive,
  Play,
  Save,
  Send,
  Sparkles,
  Trash2,
  User,
  Wand2,
} from 'lucide-react';
import { Handover, Task } from '../../types';
import { chatWithWorkspaceAI, chatWithWorkspaceTools, ToolCallResult } from '../../lib/apiService';
import { useLocalData } from '../LocalDataContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface AICopilotProps {
  tasks: Task[];
  handovers: Handover[];
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

const STUDIO_SAVES_STORE = 'trygc_studio_saves';

function Md({ content }: { content: string }) {
  return (
    <div className="space-y-2">
      {content.split('\n').filter(Boolean).map((line, index) => {
        if (line.startsWith('- ')) {
          return (
            <div key={index} className="flex gap-2 text-sm text-ink/80 leading-relaxed">
              <span className="text-citrus mt-0.5">•</span>
              <span>{line.slice(2)}</span>
            </div>
          );
        }
        if (line.startsWith('## ')) {
          return <p key={index} className="text-sm font-black text-ink">{line.slice(3)}</p>;
        }
        return <p key={index} className="text-sm text-ink/80 leading-relaxed">{line}</p>;
      })}
    </div>
  );
}

export default function AICopilot({ tasks, handovers, messages, setMessages }: AICopilotProps) {
  const { settings, canUseFeature, isWidgetEnabled, currentTeam, isMasterAdmin, executeAITool, getWorkspaceSummary } = useLocalData();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [leftOpen, setLeftOpen] = useState(true);
  const [showStudio, setShowStudio] = useState(isWidgetEnabled('aiStudio'));
  const [previewCode, setPreviewCode] = useState('<div style="padding:32px;font-family:Inter,sans-serif"><h1>TryGC AI Studio</h1><p>Use the quick actions to generate an operations visual.</p></div>');
  const [studioSaved, setStudioSaved] = useState(false);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const activeProvider = settings.aiProvider || 'openai';
  const fallbackProviders = settings.fallbackProviders?.length ? settings.fallbackProviders.join(' → ') : 'local → openai → anthropic → groq';
  const openCount = tasks.filter(task => task.status !== 'Done').length;
  const riskCount = tasks.filter(task => task.status !== 'Done' && (task.priority === 'High' || task.status === 'Blocked')).length;
  const pendingHandovers = handovers.filter(handover => handover.status === 'Pending').length;

  const tasksSummary = `${openCount} open tasks, ${riskCount} risk tasks, ${tasks.filter(task => task.carry).length} carry-over tasks for ${currentTeam}.`;
  const handoverSummary = `${pendingHandovers} pending handovers, ${handovers.filter(handover => handover.status === 'Acknowledged').length} acknowledged.`;

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const quickActions = useMemo(() => [
    { label: 'Risk Brief', prompt: 'Give me the current risk brief with the top items to act on first.' },
    { label: 'Shift Summary', prompt: 'Summarize the active handover state for the incoming shift.' },
    { label: 'Task Coaching', prompt: 'Tell me what the operations lead should clean up in the task register today.' },
    { label: 'Community Review', prompt: 'Focus only on the community workflow and tell me the weak points.' },
  ], []);

  const send = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || loading) return;

    if (!canUseFeature('ai.use')) {
      setError('Your current role does not have access to the AI workspace.');
      return;
    }

    const userMessage: Message = { role: 'user', content: text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setError('');
    setLoading(true);

    try {
      if (isMasterAdmin) {
        // Agent mode with tool execution
        const summary = getWorkspaceSummary();
        let currentHistory = [...messages, userMessage];
        let finalContent = '';
        let maxRounds = 6;

        while (maxRounds > 0) {
          maxRounds--;
          const result = await chatWithWorkspaceTools({
            history: currentHistory.map(m => ({ role: m.role, content: m.content })),
            tasksSummary: summary.tasksSummary,
            handoverSummary: summary.handoverSummary,
            memberStats: summary.memberStats,
          });

          if (result.toolCalls && result.toolCalls.length > 0) {
            for (const tc of result.toolCalls) {
              const toolResult = await executeAITool(tc.tool, tc.args);
              currentHistory = [
                ...currentHistory,
                { role: 'assistant' as const, content: `Calling tool: ${tc.tool}(${JSON.stringify(tc.args)})`, timestamp: Date.now() },
                { role: 'user' as const, content: `Tool result: ${toolResult}`, timestamp: Date.now() },
              ];
            }
          } else {
            finalContent = result.text;
            break;
          }
        }

        if (!finalContent) {
          finalContent = 'Action completed. Check the workspace for the updated state.';
        }

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: finalContent,
          timestamp: Date.now(),
        }]);
      } else {
        // Regular chat mode for non-master users
        const result = await chatWithWorkspaceAI({
          history: [...messages, userMessage].map(message => ({ role: message.role, content: message.content })),
          tasksSummary,
          handoverSummary,
        });

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: result.provider === 'mock'
            ? `${result.text}\n\nFallback path used: ${fallbackProviders}`
            : `${result.text}\n\nProvider: ${result.provider}`,
          timestamp: Date.now(),
        }]);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unexpected AI error';
      setError(message);
      setMessages(prev => [...prev, { role: 'assistant', content: `I hit an issue: ${message}`, timestamp: Date.now() }]);
    } finally {
      setLoading(false);
    }
  };

  const copyMessage = async (content: string, index: number) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(index);
    setTimeout(() => setCopiedId(null), 1200);
  };

  const renderOpsStudio = () => {
    const html = `
      <div style="padding:24px;font-family:Inter,sans-serif;background:#f8fafc;min-height:100vh">
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-bottom:20px">
          <div style="padding:18px;border-radius:18px;background:#ffffff;border:1px solid #e2e8f0"><div style="font-size:12px;color:#64748b;text-transform:uppercase;font-weight:700">Open Tasks</div><div style="font-size:36px;font-weight:800;color:#0f172a">${openCount}</div></div>
          <div style="padding:18px;border-radius:18px;background:#ffffff;border:1px solid #e2e8f0"><div style="font-size:12px;color:#64748b;text-transform:uppercase;font-weight:700">Risk Queue</div><div style="font-size:36px;font-weight:800;color:#dc2626">${riskCount}</div></div>
          <div style="padding:18px;border-radius:18px;background:#ffffff;border:1px solid #e2e8f0"><div style="font-size:12px;color:#64748b;text-transform:uppercase;font-weight:700">Pending Handovers</div><div style="font-size:36px;font-weight:800;color:#2563eb">${pendingHandovers}</div></div>
        </div>
        <div style="padding:20px;border-radius:20px;background:#ffffff;border:1px solid #e2e8f0">
          <h2 style="margin:0 0 12px 0;color:#0f172a">Operational Focus</h2>
          <p style="margin:0;color:#475569;line-height:1.6">Team scope: ${currentTeam}. This visual is generated locally so your workspace keeps working even if a cloud provider is down.</p>
        </div>
      </div>
    `;
    setPreviewCode(html);
  };

  const saveStudio = () => {
    const saves = JSON.parse(localStorage.getItem(STUDIO_SAVES_STORE) || '[]');
    saves.unshift({ code: previewCode, savedAt: new Date().toISOString() });
    localStorage.setItem(STUDIO_SAVES_STORE, JSON.stringify(saves.slice(0, 12)));
    setStudioSaved(true);
    setTimeout(() => setStudioSaved(false), 1500);
  };

  const downloadStudio = () => {
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(new Blob([previewCode], { type: 'text/html' }));
    anchor.download = `trygc-ai-studio-${Date.now()}.html`;
    anchor.click();
  };

  return (
    <div className="h-[calc(100vh-140px)] flex gap-4">
      <aside className={`${leftOpen ? 'w-[320px]' : 'w-14'} transition-all duration-300 bg-white border border-dawn rounded-[28px] shadow-lg overflow-hidden flex flex-col`}>
        <div className="flex items-center justify-between px-4 py-4 border-b border-dawn">
          {leftOpen && (
            <div>
              <p className="text-sm font-black text-ink">AI Workspace</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Provider and shortcuts</p>
            </div>
          )}
          <button onClick={() => setLeftOpen(open => !open)} className="w-8 h-8 rounded-xl border border-dawn flex items-center justify-center text-muted hover:text-ink">
            {leftOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        {leftOpen && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {isWidgetEnabled('aiProviderPanel') && (
              <div className="p-4 bg-stone/40 rounded-2xl border border-dawn space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Active Provider</span>
                  <span className="px-2 py-1 bg-citrus/10 text-citrus rounded-lg text-[9px] font-black uppercase">{activeProvider}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-[10px] font-bold text-muted">
                  <div className="p-3 bg-white rounded-xl border border-dawn">
                    <div className="flex items-center gap-2 mb-2"><Cloud className="w-3.5 h-3.5" />Primary</div>
                    <p className="text-ink">{settings.aiModel || 'Default model'}</p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-dawn">
                    <div className="flex items-center gap-2 mb-2"><HardDrive className="w-3.5 h-3.5" />Fallback</div>
                    <p className="text-ink">Local-first</p>
                  </div>
                </div>
                <p className="text-[10px] font-bold text-muted leading-relaxed">Fallback chain: {fallbackProviders}</p>
              </div>
            )}

            <div className="p-4 bg-ink text-white rounded-2xl space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-citrus" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Live Scope</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-2xl font-black">{openCount}</p>
                  <p className="text-[10px] font-bold text-white/60 uppercase">Open Tasks</p>
                </div>
                <div>
                  <p className="text-2xl font-black">{pendingHandovers}</p>
                  <p className="text-[10px] font-bold text-white/60 uppercase">Pending Handover</p>
                </div>
              </div>
              <p className="text-[11px] font-bold text-white/70">{currentTeam}</p>
            </div>

            {isWidgetEnabled('aiQuickPrompts') && (
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Quick Actions</p>
                {quickActions.map(action => (
                  <button
                    key={action.label}
                    onClick={() => send(action.prompt)}
                    className="w-full p-3 bg-white border border-dawn rounded-2xl text-left hover:border-citrus/30 hover:bg-citrus/5 transition-all"
                  >
                    <p className="text-xs font-black text-ink">{action.label}</p>
                    <p className="text-[10px] font-bold text-muted mt-1">{action.prompt}</p>
                  </button>
                ))}
              </div>
            )}

            {isWidgetEnabled('aiStudio') && (
              <div className="p-4 bg-stone/40 rounded-2xl border border-dawn space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Studio</p>
                  <button onClick={() => setShowStudio(show => !show)} className="text-[9px] font-black uppercase tracking-widest text-citrus">
                    {showStudio ? 'Hide' : 'Show'}
                  </button>
                </div>
                <button onClick={renderOpsStudio} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-citrus text-ink rounded-xl text-[10px] font-black uppercase tracking-widest">
                  <Wand2 className="w-3.5 h-3.5" />
                  Generate Visual
                </button>
              </div>
            )}
          </div>
        )}
      </aside>

      <div className="min-w-0 flex-1 grid grid-rows-[1fr,auto] gap-4">
        <div className="bg-white rounded-[28px] border border-dawn shadow-lg overflow-hidden flex flex-col min-h-0">
          <div className="flex items-center justify-between px-5 py-4 border-b border-dawn bg-stone/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-ink text-white flex items-center justify-center">
                <Bot className="w-4.5 h-4.5" />
              </div>
              <div>
                <p className="text-sm font-black text-ink">Copilot Chat</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Local-safe responses with API fallback</p>
              </div>
            </div>
            <button
              onClick={() => {
                setMessages([{ role: 'assistant', content: 'Chat cleared. I am ready for the next operational question.', timestamp: Date.now() }]);
                setError('');
              }}
              className="w-9 h-9 rounded-xl border border-dawn flex items-center justify-center text-muted hover:text-red-500 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {error && (
            <div className="mx-5 mt-4 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl text-xs font-bold text-red-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="flex-1">{error}</span>
            </div>
          )}

          <div ref={scrollerRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4 custom-scrollbar">
            {messages.map((message, index) => (
              <div key={`${message.timestamp}-${index}`} className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${message.role === 'user' ? 'bg-stone border border-dawn' : 'bg-citrus text-white'}`}>
                  {message.role === 'user' ? <User className="w-4 h-4 text-muted" /> : <Sparkles className="w-4 h-4" />}
                </div>
                <div className={`max-w-[78%] ${message.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  <div className={`px-4 py-3 rounded-2xl shadow-sm ${message.role === 'user' ? 'bg-ink text-white rounded-tr-sm' : 'bg-stone/60 border border-dawn rounded-tl-sm'}`}>
                    {message.role === 'assistant' ? <Md content={message.content} /> : <p className="text-sm leading-relaxed">{message.content}</p>}
                  </div>
                  <div className={`flex items-center gap-2 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <span className="text-[9px] font-bold text-muted/40">
                      {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button onClick={() => copyMessage(message.content, index)} className="text-muted hover:text-ink">
                      {copiedId === index ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-xl bg-citrus text-white flex items-center justify-center">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                </div>
                <div className="px-4 py-3 bg-stone/60 border border-dawn rounded-2xl rounded-tl-sm text-sm font-bold text-muted">
                  Working through the workspace context...
                </div>
              </div>
            )}
          </div>

          <div className="px-5 py-4 border-t border-dawn bg-white">
            <div className="flex items-center gap-3 bg-stone/50 border border-dawn rounded-2xl px-4 py-3">
              <input
                value={input}
                onChange={event => setInput(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    send();
                  }
                }}
                placeholder="Ask about task flow, handovers, blockers, team separation, or the next shift..."
                className="flex-1 bg-transparent text-sm font-medium focus:outline-none placeholder:text-muted/40"
              />
              <button
                onClick={() => send()}
                disabled={loading || !input.trim()}
                className="w-10 h-10 rounded-xl bg-ink text-white flex items-center justify-center disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {showStudio && isWidgetEnabled('aiStudio') && (
          <div className="bg-white rounded-[24px] border border-dawn shadow-lg overflow-hidden h-[320px]">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
              <div className="flex items-center gap-2 text-white/70">
                <Code className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">AI Studio</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => { if (iframeRef.current) iframeRef.current.srcdoc = previewCode; }} className="p-2 text-white/50 hover:text-green-400"><Play className="w-3.5 h-3.5" /></button>
                <button onClick={saveStudio} className="p-2 text-white/50 hover:text-blue-400">{studioSaved ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Save className="w-3.5 h-3.5" />}</button>
                <button onClick={downloadStudio} className="p-2 text-white/50 hover:text-citrus"><Download className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            <div className="grid grid-cols-2 h-[calc(100%-49px)]">
              <textarea
                value={previewCode}
                onChange={event => setPreviewCode(event.target.value)}
                className="w-full h-full bg-slate-900 text-green-400 font-mono text-xs p-4 resize-none focus:outline-none custom-scrollbar"
                spellCheck={false}
              />
              <iframe ref={iframeRef} title="AI Studio Preview" className="w-full h-full border-none bg-white" srcDoc={previewCode} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
