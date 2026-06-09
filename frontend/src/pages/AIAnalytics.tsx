import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { 
  Sparkles, TrendingUp, ShoppingCart, Loader2, AlertCircle, 
  CheckCircle2, Cpu, Send, Zap
} from 'lucide-react';

interface DemandForecast {
  id: string;
  target_date: string;
  predicted_orders: number;
  predicted_revenue: number;
  confidence_score: number;
  model_version: string;
}

interface AIRecommendation {
  id: string;
  type: string;
  title: string;
  description: string;
  impact_level: string;
  action_data: any;
  status: string;
  created_at: string;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'copilot';
  text: string;
  timestamp: string;
}

export const AIAnalytics: React.FC = () => {
  const { user } = useAuth();
  
  // States
  const [forecasts, setForecasts] = useState<DemandForecast[]>([]);
  const [recs, setRecs] = useState<AIRecommendation[]>([]);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [loadingRec, setLoadingRec] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Copilot States
  const [chatInput, setChatInput] = useState('');
  const [copilotTyping, setCopilotTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'copilot',
      text: `Olá, **${user?.name}**! Sou o seu **Copiloto Operacional de IA** 🤖. \n\nPosso analisar as vendas, estoques físicos, e escalas de turnos em tempo real diretamente do banco de dados.\n\nClique em uma das sugestões rápidas abaixo ou me faça uma pergunta!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchForecasts = async () => {
    setLoadingForecast(true);
    try {
      const res = await api.get('/ai/forecast');
      setForecasts(res.data);
    } catch (err) {
      console.error('Falha ao obter previsões de demanda', err);
    } finally {
      setLoadingForecast(false);
    }
  };

  const fetchRecommendations = async () => {
    setLoadingRec(true);
    try {
      const res = await api.get('/ai/recommendations');
      setRecs(res.data.filter((r: AIRecommendation) => r.status === 'PENDING'));
    } catch (err) {
      console.error('Falha ao obter recomendações', err);
    } finally {
      setLoadingRec(false);
    }
  };

  useEffect(() => {
    fetchForecasts();
    fetchRecommendations();
  }, []);

  useEffect(() => {
    // Scroll chat to bottom on new messages
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, copilotTyping]);

  const triggerSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 4000);
  };

  const triggerError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 4000);
  };

  // Recommendation Actions
  const handleApplyRec = async (id: string) => {
    setError(null);
    try {
      const res = await api.post(`/ai/recommendations/${id}/apply`);
      triggerSuccess(res.data.message);
      fetchRecommendations();
    } catch (err: any) {
      triggerError(err.response?.data?.detail || 'Erro ao aplicar recomendação.');
    }
  };

  const handleDismissRec = async (id: string) => {
    setError(null);
    try {
      await api.post(`/ai/recommendations/${id}/dismiss`);
      triggerSuccess('Recomendação ignorada.');
      fetchRecommendations();
    } catch (err: any) {
      triggerError(err.response?.data?.detail || 'Erro ao dispensar recomendação.');
    }
  };

  // Chat Copilot Handler
  const handleSendCopilot = async (text: string) => {
    if (!text.trim()) return;

    const userMsgId = uuidv4();
    const newUserMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, newUserMsg]);
    setChatInput('');
    setCopilotTyping(true);

    try {
      // Pequeno atraso simulado de pesquisa visualmente atraente
      await new Promise(resolve => setTimeout(resolve, 600));
      
      const res = await api.post('/ai/copilot', { message: text });
      const fullText = res.data.response;
      
      setCopilotTyping(false);
      
      const copilotMsgId = uuidv4();
      const copilotMsg: ChatMessage = {
        id: copilotMsgId,
        sender: 'copilot',
        text: '',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      
      setMessages(prev => [...prev, copilotMsg]);
      
      // Efeito de digitação gradual (Streaming Typewriter Effect)
      let currentText = '';
      let index = 0;
      const speed = 8; // ms de intervalo para um surgimento rápido e natural
      const chunkSize = 4; // caracteres por tick
      
      const interval = setInterval(() => {
        if (index < fullText.length) {
          currentText += fullText.slice(index, index + chunkSize);
          index += chunkSize;
          setMessages(prev => prev.map(m => m.id === copilotMsgId ? { ...m, text: currentText } : m));
        } else {
          clearInterval(interval);
        }
      }, speed);
      
    } catch (err) {
      setCopilotTyping(false);
      const errorMsg: ChatMessage = {
        id: uuidv4(),
        sender: 'copilot',
        text: 'Desculpe, ocorreu uma falha de comunicação com meu núcleo de processamento. Tente novamente.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    }
  };

  const uuidv4 = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  // Simple Markdown to HTML Renderer helper inside the browser
  const renderMarkdown = (text: string) => {
    return text.split('\n').map((line, idx) => {
      let content = line;
      
      // Bold text
      content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Inline code
      content = content.replace(/`(.*?)`/g, '<code class="px-1.5 py-0.5 bg-black/40 text-purple-400 font-mono rounded text-xs">$1</code>');

      // Headings
      if (content.startsWith('### ')) {
        return <h4 key={idx} className="text-sm font-bold text-white mt-4 mb-2 flex items-center gap-2 border-b border-white/5 pb-1">{content.replace('### ', '')}</h4>;
      }
      
      // Table rows mapping
      if (content.startsWith('|')) {
        const cols = content.split('|').map(c => c.trim()).filter(c => c !== '');
        
        // Skip header separators like :--- or ---
        if (cols.some(c => c.includes('---') || c.includes(':---'))) {
          return null;
        }

        const isHeader = line.includes('Insumo') || line.includes('Fornecedor') || line.includes('Colaborador');
        
        return (
          <div key={idx} className={`grid grid-cols-${cols.length} gap-2 py-1.5 border-b border-white/5 text-[11px] font-mono ${isHeader ? 'font-bold text-purple-400 border-b-2 border-purple-500/20' : 'text-white'}`}>
            {cols.map((col, cIdx) => (
              <span key={cIdx} className="truncate" dangerouslySetInnerHTML={{ __html: col }} />
            ))}
          </div>
        );
      }

      // Bullets
      if (content.startsWith('- ')) {
        return (
          <li key={idx} className="list-disc ml-4 py-0.5 text-xs text-slate-300" dangerouslySetInnerHTML={{ __html: content.replace('- ', '') }} />
        );
      }

      return (
        <p key={idx} className="text-xs text-slate-200/90 leading-relaxed py-0.5" dangerouslySetInnerHTML={{ __html: content }} />
      );
    });
  };

  const maxRevenue = forecasts.length > 0 ? Math.max(...forecasts.map(f => f.predicted_revenue)) : 1000;
  const chartWidth = 500;
  const numPoints = Math.max(forecasts.length, 1);
  const spacing = Math.min(60, (chartWidth - 80) / Math.max(numPoints - 1, 1));
  const chartPoints = forecasts.map((f, index) => {
    const x = 60 + (index * spacing);
    const y = 175 - ((f.predicted_revenue / maxRevenue) * 120);
    return { x, y, ...f };
  });
  const svgPolylinePoints = chartPoints.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 rounded-xl flex items-center gap-3 text-sm animate-fade-in"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
          <AlertCircle size={15} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-4 rounded-xl flex items-center gap-3 text-sm animate-fade-in"
          style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', color: '#6ee7b7' }}>
          <CheckCircle2 size={15} className="shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Faturamento Previsto */}
        <div className="metric-card p-6 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="icon-chip" style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)' }}>
                <Sparkles size={18} className="text-violet-400" />
              </span>
              <span className="text-sm font-semibold text-slate-300">Faturamento Previsto</span>
            </div>
            <span className="trend-badge-up flex-shrink-0"><TrendingUp size={10} />+IA</span>
          </div>
          <div>
            <p className="text-[26px] font-bold text-white leading-none" style={{ fontFamily: 'Outfit, sans-serif' }}>
              R$ {forecasts.reduce((s, f) => s + f.predicted_revenue, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-slate-500 mt-2">Próximos 7 dias — série temporal ponderada</p>
          </div>
        </div>

        {/* Vendas Estimadas */}
        <div className="metric-card p-6 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="icon-chip" style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}>
                <ShoppingCart size={18} className="text-indigo-400" />
              </span>
              <span className="text-sm font-semibold text-slate-300">Vendas Estimadas</span>
            </div>
            <span className="trend-badge-neutral flex-shrink-0"><TrendingUp size={10} />Previsto</span>
          </div>
          <div>
            <p className="text-[26px] font-bold text-white leading-none" style={{ fontFamily: 'Outfit, sans-serif' }}>
              {forecasts.reduce((s, f) => s + f.predicted_orders, 0)}
              <span className="text-sm text-slate-500 font-normal ml-2">pedidos</span>
            </p>
            <p className="text-xs text-slate-500 mt-2">Volume operacional projetado para a semana</p>
          </div>
        </div>

        {/* Insights de IA */}
        <div className="metric-card p-6 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="icon-chip" style={{ background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(20,184,166,0.2)' }}>
                <Cpu size={18} className="text-teal-400" />
              </span>
              <span className="text-sm font-semibold text-slate-300">Insights de IA</span>
            </div>
            {recs.length > 0 && <span className="trend-badge-up flex-shrink-0"><Zap size={10} />{recs.length} ativos</span>}
          </div>
          <div>
            <p className="text-[26px] font-bold text-white leading-none" style={{ fontFamily: 'Outfit, sans-serif' }}>
              {recs.length}
              <span className="text-sm text-slate-500 font-normal ml-2">recomendações</span>
            </p>
            <p className="text-xs text-slate-500 mt-2">Ações preventivas do scorecard de IA</p>
          </div>
        </div>
      </div>

      {/* Main Grid Layout: Chart & Recommendations vs Copilot */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: SVGLines + Active Recs */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Neon SVG Chart Card */}
          <div className="glass-panel p-6 rounded-3xl border-white/5">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-purple-400" />
                  <span>Curva de Previsão de Demanda (Próximos 7 Dias)</span>
                </h4>
                <p className="text-[10px] text-muted-foreground mt-0.5">Faturamento bruto estimado por análise histórica.</p>
              </div>

              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                <span className="text-[9px] font-bold uppercase tracking-wider text-purple-400">Heuristics v1</span>
              </div>
            </div>

            {loadingForecast ? (
              <div className="h-60 flex flex-col items-center justify-center gap-3 text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
                <span className="text-xs">Processando série temporal de vendas...</span>
              </div>
            ) : forecasts.length === 0 ? (
              <div className="h-60 flex items-center justify-center text-xs text-slate-500">Sem dados de previsões.</div>
            ) : (
              /* Container com overflow:hidden para clipar tooltips SVG */
              <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 12 }}>
                <svg viewBox="0 0 500 210" style={{ width: '100%', height: 240, display: 'block' }} overflow="visible">
                  <defs>
                    <linearGradient id="neon-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#c084fc" stopOpacity="0.6" />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity="0.05" />
                    </linearGradient>
                    <linearGradient id="line-grad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#a855f7" />
                      <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                    <filter id="glow" x="-10%" y="-10%" width="120%" height="120%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                    <clipPath id="chart-clip">
                      <rect x="0" y="0" width="500" height="210" />
                    </clipPath>
                  </defs>

                  {/* Horizontal grid lines */}
                  <line x1="30" y1="40" x2="480" y2="40" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                  <line x1="30" y1="90" x2="480" y2="90" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                  <line x1="30" y1="140" x2="480" y2="140" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                  <line x1="30" y1="175" x2="480" y2="175" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />

                  {/* Area + polyline inside clip */}
                  <g clipPath="url(#chart-clip)">
                    {chartPoints.length > 0 && (
                      <path
                        d={`M ${chartPoints[0].x},175 ` + chartPoints.map(p => `L ${p.x},${p.y}`).join(' ') + ` L ${chartPoints[chartPoints.length-1].x},175 Z`}
                        fill="url(#neon-grad)"
                      />
                    )}
                    <polyline
                      fill="none"
                      stroke="url(#line-grad)"
                      strokeWidth="2.5"
                      points={svgPolylinePoints}
                      filter="url(#glow)"
                    />
                  </g>

                  {/* Data circles & tooltips */}
                  {chartPoints.map((p) => {
                    const dateObj = new Date(p.target_date);
                    const label = dateObj.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' });
                    const tooltipX = Math.min(Math.max(p.x, 50), 450);
                    const tooltipY = Math.max(p.y - 50, 10);
                    return (
                      <g key={p.id} className="group cursor-pointer">
                        <circle cx={p.x} cy={p.y} r="5"
                          fill="#8b5cf6" stroke="#0b0f19" strokeWidth="2"
                          className="transition-all duration-200"
                        />
                        <text x={p.x} y="195" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="8" fontFamily="monospace">
                          {label}
                        </text>
                        {/* Tooltip clipped to viewBox */}
                        <g className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none">
                          <rect x={tooltipX - 48} y={tooltipY} width="96" height="38" rx="8"
                            fill="#0d1117" stroke="rgba(139,92,246,0.4)" strokeWidth="1" />
                          <text x={tooltipX} y={tooltipY + 14} textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">
                            R$ {p.predicted_revenue.toFixed(0)}
                          </text>
                          <text x={tooltipX} y={tooltipY + 28} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="8" fontFamily="monospace">
                            {p.predicted_orders} ped. ({intPercent(p.confidence_score)})
                          </text>
                        </g>
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}
          </div>

          {/* Recommendations Hub list */}
          <div className="glass-panel p-6 rounded-3xl border-white/5 space-y-4">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-purple-400 animate-spin-slow" />
                <span>Central de Insights e Ações de IA</span>
              </h4>
              <p className="text-[10px] text-muted-foreground mt-0.5">Sugestões de reabastecimento automático e escalas baseadas em previsões de vendas.</p>
            </div>

            {loadingRec ? (
              <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
                <span className="text-xs">Computando alertas operacionais...</span>
              </div>
            ) : recs.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500 rounded-xl"
                style={{ border: '1px dashed rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.01)' }}>
                🎉 <strong>Tudo sob controle!</strong> O motor de IA não identificou nenhum gargalo.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recs.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-col justify-between rounded-xl p-5 transition-all"
                    style={{
                      background: r.impact_level === 'HIGH' ? 'rgba(239,68,68,0.06)' : 'rgba(139,92,246,0.06)',
                      border: `1px solid ${r.impact_level === 'HIGH' ? 'rgba(239,68,68,0.15)' : 'rgba(139,92,246,0.15)'}`,
                    }}
                  >
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-3">
                        <span className={`px-2 py-0.5 border rounded-full text-[9px] font-semibold flex items-center gap-1 ${
                          r.impact_level === 'HIGH'
                            ? 'text-red-400 bg-red-500/10 border-red-500/20'
                            : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                        }`}>
                          <Zap size={10} className="shrink-0" />
                          <span>Impacto {r.impact_level === 'HIGH' ? 'Alto' : 'Médio'}</span>
                        </span>
                        <span className="text-[8px] font-mono text-slate-500">
                          {r.type === 'STOCK_REPLENISHMENT' ? 'Estoque' : 'Equipe'}
                        </span>
                      </div>
                      <h5 className="text-xs font-bold text-white leading-snug">{r.title}</h5>
                      <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">{r.description}</p>
                    </div>
                    <div className="flex gap-2.5 pt-4 mt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <button
                        onClick={() => handleDismissRec(r.id)}
                        className="flex-1 py-1.5 text-slate-400 hover:text-white rounded-xl text-[9px] font-semibold transition-all"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                      >
                        Ignorar
                      </button>
                      <button
                        onClick={() => handleApplyRec(r.id)}
                        className="flex-1 py-1.5 text-white font-bold rounded-xl text-[9px] transition-all flex items-center justify-center gap-1"
                        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 4px 12px rgba(124,58,237,0.25)' }}
                      >
                        <Zap size={10} />
                        <span>Aplicar</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right Column: AI Chat Copilot Window */}
        <div className="lg:col-span-4">
          <div className="glass-panel rounded-2xl overflow-hidden flex flex-col relative" style={{ height: 560 }}>
            
            {/* Header info */}
            <div className="p-4 border-b border-white/5 bg-white/[0.01] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white relative shadow-lg shadow-purple-950/20">
                  <Cpu className="w-4 h-4 animate-pulse" />
                  <span className="w-2 h-2 rounded-full bg-emerald-500 border border-slate-950 absolute -bottom-0.5 -right-0.5 animate-ping-slow" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white tracking-tight">Copiloto Operacional</h4>
                  <p className="text-[8px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span>Conectado à Base SQLite</span>
                  </p>
                </div>
              </div>

              <span className="px-2 py-0.5 bg-white/5 border border-white/5 rounded-lg text-[8px] font-mono text-white">AI-Heuristics</span>
            </div>

            {/* Chat Body messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((m) => (
                <div 
                  key={m.id} 
                  className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div 
                    className={`p-3.5 rounded-2xl max-w-[85%] text-xs space-y-1.5 relative ${
                      m.sender === 'user'
                        ? 'bg-purple-600 text-white rounded-tr-none shadow-lg shadow-purple-950/10'
                        : 'glass-panel border-white/5 rounded-tl-none bg-white/[0.02] text-slate-100'
                    }`}
                  >
                    {m.sender === 'copilot' ? (
                      <div className="space-y-2">
                        {renderMarkdown(m.text)}
                      </div>
                    ) : (
                      <p className="leading-relaxed">{m.text}</p>
                    )}
                  </div>
                  
                  <span className="text-[7px] text-muted-foreground mt-1 px-1.5 font-mono">{m.timestamp}</span>
                </div>
              ))}

              {copilotTyping && (
                <div className="flex flex-col items-start">
                  <div className="glass-panel border-white/5 p-3 rounded-2xl rounded-tl-none bg-white/[0.01] text-xs flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                    <span className="text-[10px] text-muted-foreground font-mono">Pesquisando tabelas...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions selector pills */}
            <div className="p-3 border-t border-white/5 bg-white/[0.005] space-y-2">
              <p className="text-[7px] font-bold uppercase tracking-wider text-purple-400">Sugestões rápidas</p>
              <div className="flex gap-1.5 overflow-x-auto pb-1 flex-nowrap scrollbar-none">
                <button
                  onClick={() => handleSendCopilot('Como está meu faturamento e vendas?')}
                  disabled={copilotTyping}
                  className="px-2.5 py-1.5 bg-white/5 hover:bg-purple-600/10 hover:text-purple-400 hover:border-purple-500/20 active:bg-white/10 text-muted-foreground rounded-xl text-[9px] font-semibold shrink-0 border border-white/5 transition-all"
                >
                  📊 Faturamento
                </button>
                
                <button
                  onClick={() => handleSendCopilot('Quais insumos estão acabando no estoque?')}
                  disabled={copilotTyping}
                  className="px-2.5 py-1.5 bg-white/5 hover:bg-purple-600/10 hover:text-purple-400 hover:border-purple-500/20 active:bg-white/10 text-muted-foreground rounded-xl text-[9px] font-semibold shrink-0 border border-white/5 transition-all"
                >
                  ⚠️ Alertas Estoque
                </button>

                <button
                  onClick={() => handleSendCopilot('Quem está escalado para trabalhar hoje?')}
                  disabled={copilotTyping}
                  className="px-2.5 py-1.5 bg-white/5 hover:bg-purple-600/10 hover:text-purple-400 hover:border-purple-500/20 active:bg-white/10 text-muted-foreground rounded-xl text-[9px] font-semibold shrink-0 border border-white/5 transition-all"
                >
                  📅 Escala de Hoje
                </button>

                <button
                  onClick={() => handleSendCopilot('Quais fornecedores temos cadastrados?')}
                  disabled={copilotTyping}
                  className="px-2.5 py-1.5 bg-white/5 hover:bg-purple-600/10 hover:text-purple-400 hover:border-purple-500/20 active:bg-white/10 text-muted-foreground rounded-xl text-[9px] font-semibold shrink-0 border border-white/5 transition-all"
                >
                  🤝 Fornecedores
                </button>
              </div>
            </div>

            {/* Chat Input field */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleSendCopilot(chatInput);
              }}
              className="p-3 border-t border-white/5 bg-slate-950 flex items-center gap-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={copilotTyping}
                placeholder="Perguntar ao copiloto..."
                className="flex-1 px-4 py-2.5 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-2xl text-white placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/10 text-xs transition-all"
              />
              
              <button
                type="submit"
                disabled={!chatInput.trim() || copilotTyping}
                className="p-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-30 disabled:pointer-events-none text-white rounded-xl transition-all shadow-lg shadow-purple-950/20 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>

          </div>
        </div>

      </div>
    </div>
  );
};

const intPercent = (n: number) => {
  return `${Math.round(n * 100)}%`;
};
