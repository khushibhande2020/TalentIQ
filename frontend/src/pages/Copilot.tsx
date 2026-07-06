import { useState, useRef, useEffect } from 'react';
import { Send, Brain, Trash2, Bot, User, Info, Zap } from 'lucide-react';
import { copilotChat, clearCopilotSession } from '@/lib/api';
import { Card, PageHeader, Spinner, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  ai_generated?: boolean;
  data_used?: string[];
  timestamp?: string;
}

const STARTERS = [
  'How many candidates are in the pool?',
  'What are the top 5 skills in our talent pool?',
  'What is the average match score?',
  'Show me the hiring funnel breakdown',
  'Which industries are most represented?',
  'How is the experience distribution?',
];

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  return (
    <div className={cn('flex items-start gap-3', isUser && 'flex-row-reverse')}>
      <div className={cn(
        'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0',
        isUser ? 'gradient-bg shadow-md shadow-brand-500/30' : 'bg-slate-100 dark:bg-slate-800'
      )}>
        {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-brand-500" />}
      </div>
      <div className={cn('max-w-[78%] space-y-1.5', isUser && 'items-end')}>
        <div className={cn(
          'rounded-2xl px-4 py-3 text-sm leading-relaxed',
          isUser
            ? 'gradient-bg text-white rounded-tr-sm'
            : 'glass text-slate-700 dark:text-slate-300 rounded-tl-sm'
        )}>
          {/* Render simple markdown-ish bold */}
          {msg.content.split(/\*\*(.*?)\*\*/g).map((part, i) =>
            i % 2 === 1
              ? <strong key={i} className="font-bold">{part}</strong>
              : <span key={i}>{part}</span>
          )}
        </div>
        <div className={cn('flex items-center gap-2 flex-wrap', isUser && 'justify-end')}>
          {msg.ai_generated && <Badge className="badge-purple text-[9px]">Gemini</Badge>}
          {msg.data_used?.map(d => <Badge key={d} className="badge-blue text-[9px]">{d}</Badge>)}
          {msg.timestamp && (
            <span className="text-[10px] text-slate-400">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hello! I'm TalentIQ Copilot — your AI hiring assistant. Ask me anything about your candidate pool, match scores, skills, hiring funnel, or recruitment strategy. I have live access to your platform data.",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(`session_${Date.now()}`);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');

    const userMsg: Message = { role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await copilotChat(msg, sessionId);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.response,
        ai_generated: res.ai_generated,
        data_used: res.data_used,
        timestamp: res.timestamp,
      }]);
    } catch (e: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠️ Sorry, I encountered an error. Please try again.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    await clearCopilotSession(sessionId).catch(() => {});
    setMessages([{
      role: 'assistant',
      content: "Conversation cleared! How can I help you with your hiring intelligence?",
    }]);
  };

  return (
    <div>
      <PageHeader
        title="AI Hiring Copilot"
        subtitle="Ask natural language questions — answered using live platform data and Gemini AI"
        action={
          <button onClick={handleClear} className="btn-secondary flex items-center gap-2">
            <Trash2 className="w-4 h-4" /> Clear Chat
          </button>
        }
      />

      <div className="grid grid-cols-4 gap-6 h-[calc(100vh-200px)]">
        {/* ── Sidebar: Starters + Tips ─────────────────────────────────────── */}
        <div className="space-y-4">
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-brand-500" />
              <p className="font-semibold text-slate-800 dark:text-white text-sm">Quick Questions</p>
            </div>
            <div className="space-y-1.5">
              {STARTERS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  disabled={loading}
                  className="w-full text-left text-xs px-3 py-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 hover:bg-brand-50 dark:hover:bg-brand-900/20 text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-blue-500" />
              <p className="font-semibold text-slate-800 dark:text-white text-sm">Data Sources</p>
            </div>
            <div className="space-y-1.5 text-xs text-slate-500">
              {[
                'Platform statistics',
                'Skill analytics',
                'Experience data',
                'Location insights',
                'Industry breakdown',
                'Hiring funnel',
                'Match score data',
              ].map((d, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                  {d}
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ── Chat Area ────────────────────────────────────────────────────── */}
        <div className="col-span-3 flex flex-col glass rounded-2xl border border-white/10 overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} />
            ))}
            {loading && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-brand-500" />
                </div>
                <div className="glass rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                  <Spinner size={14} />
                  <span className="text-sm text-slate-400">Analyzing platform data…</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-slate-200/40 dark:border-white/5 p-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Brain className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-400" />
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder="Ask about your talent pool, match scores, skills, trends…"
                  className="input-field pl-10 pr-4"
                  disabled={loading}
                />
              </div>
              <button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                className="btn-primary px-4 flex items-center gap-2 disabled:opacity-40"
              >
                {loading ? <Spinner size={16} /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 text-center">
              Answers powered by live platform data + Gemini AI · Session: {sessionId.slice(-8)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
