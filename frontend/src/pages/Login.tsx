import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Mail, Lock, ArrowRight, Loader2, AlertCircle, Eye, EyeOff, BarChart3, Layers, Zap, Database, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState<string | null>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setError(null);
    setIsLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        const errorMessages = detail.map((d: any) => {
          const field = d.loc[d.loc.length - 1];
          const label = field === 'email' ? 'E-mail' : field === 'password' ? 'Senha' : field;
          let msg = d.msg;
          if (msg.includes('at least 6 characters')) msg = 'deve ter pelo menos 6 caracteres';
          else if (msg.includes('valid email address')) msg = 'deve ser um e-mail válido';
          return `${label}: ${msg}`;
        });
        setError(errorMessages.join(', '));
      } else if (typeof detail === 'string') {
        setError(detail);
      } else {
        setError('Credenciais inválidas. Verifique seu e-mail e senha.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeedDb = async () => {
    setIsSeeding(true);
    setError(null);
    setSeedSuccess(null);
    try {
      const res = await api.post('/system/seed');
      setSeedSuccess(res.data.message || 'Banco populado com sucesso!');
    } catch (err: any) {
      setError('Erro ao popular banco de dados: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsSeeding(false);
    }
  };

  const isEmailValid = EMAIL_REGEX.test(email);
  const isPasswordValid = password.length >= 6;

  return (
    <div className="min-h-screen w-full flex bg-[#080d1a] overflow-hidden">

      {/* ================= LEFT SIDE: BRANDING & MARKETING (Hidden on Mobile) ================= */}
      <div className="hidden lg:flex w-[55%] relative flex-col justify-between p-12 border-r border-white/5 bg-[#0b1120]/50 z-10">
        {/* Background Decorative Elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full filter blur-[120px] pointer-events-none animate-pulse-glow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-indigo-600/10 rounded-full filter blur-[120px] pointer-events-none animate-pulse-glow" style={{ animationDelay: '2s' }} />

        {/* Logo */}
        <div className="flex items-center gap-3 animate-fade-in-up">
          <div className="p-2.5 bg-white/5 border border-white/10 rounded-xl">
            <Shield className="w-7 h-7 text-purple-400" />
          </div>
          <span className="text-2xl font-extrabold tracking-tight text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Gestor<span className="text-purple-400">SaaS</span>
          </span>
        </div>

        {/* Value Proposition */}
        <div className="max-w-xl relative z-10 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <h1 className="text-5xl font-bold leading-[1.1] mb-6 text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>
            O controle total do seu negócio em <span className="text-gradient-violet">tempo real</span>.
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed mb-10">
            A plataforma inteligente definitiva para PMEs. Automatize processos, monitore métricas financeiras e escale sua operação com segurança militar.
          </p>

          {/* Feature Badges */}
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm text-slate-300">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              <span>Métricas em Tempo Real</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm text-slate-300">
              <Layers className="w-4 h-4 text-blue-400" />
              <span>Estoque Automatizado</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm text-slate-300">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Alta Performance</span>
            </div>
          </div>
        </div>

        {/* Footer / Trust */}
        <div className="text-sm text-slate-500 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <p>© {new Date().getFullYear()} GestorSaaS Inc. Todos os direitos reservados.</p>
        </div>
      </div>

      {/* ================= RIGHT SIDE: LOGIN FORM ================= */}
      <div className="w-full lg:w-[45%] flex items-center justify-center p-6 sm:p-12 relative z-20">

        {/* Mobile only logo (shows if left side is hidden) */}
        <div className="absolute top-8 left-8 lg:hidden flex items-center gap-2">
          <Shield className="w-6 h-6 text-purple-400" />
          <span className="text-xl font-extrabold text-white">Gestor<span className="text-purple-400">SaaS</span></span>
        </div>

        <div className="w-full max-w-[420px] animate-fade-in-up" style={{ animationDelay: '0.3s' }}>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>Bem-vindo de volta</h2>
            <p className="text-muted-foreground">Insira suas credenciais para acessar o painel.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 text-red-200 text-sm animate-fade-in">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <div className="glass-panel p-6 sm:p-8 rounded-[24px]">
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 ml-1">
                  E-mail Profissional
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-purple-400 transition-colors">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="exemplo@suaempresa.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setEmailTouched(true);
                    }}
                    onBlur={() => setEmailTouched(true)}
                    disabled={isLoading}
                    className={`w-full pl-12 pr-4 py-3.5 bg-[#0c1225]/80 border rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all text-sm ${emailTouched && !isEmailValid ? 'border-red-500/40 focus:border-red-500/50' : 'border-white/10 focus:border-purple-500/50'
                      }`}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <div className="flex items-center justify-between mb-2 ml-1">
                  <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Senha de Acesso
                  </label>
                  <Link to="/forgot-password" className="text-xs font-medium text-purple-400 hover:text-purple-300 transition-colors">
                    Esqueci a senha
                  </Link>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-purple-400 transition-colors">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setPasswordTouched(true);
                    }}
                    onBlur={() => setPasswordTouched(true)}
                    disabled={isLoading}
                    className={`w-full pl-12 pr-12 py-3.5 bg-[#0c1225]/80 border rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all text-sm ${passwordTouched && !isPasswordValid ? 'border-red-500/40 focus:border-red-500/50' : 'border-white/10 focus:border-purple-500/50'
                      }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || (emailTouched && !isEmailValid) || (passwordTouched && !isPasswordValid)}
                className="w-full py-3.5 mt-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:from-purple-700 text-white font-semibold rounded-xl shadow-lg shadow-purple-900/30 flex items-center justify-center gap-2 transition-all hover:translate-y-[-1px] active:translate-y-[1px] disabled:opacity-50 disabled:transform-none"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Autenticando...</span>
                  </>
                ) : (
                  <>
                    <span>Entrar no Sistema</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="mt-8 text-center text-sm text-slate-400">
            Ainda não cadastrou sua empresa?{' '}
            <Link to="/register" className="text-purple-400 font-semibold hover:text-purple-300 transition-colors">
              Criar conta gratuita
            </Link>
          </p>

          {/* SEED DATABASE SECTION */}
          <div className="mt-8 p-6 bg-purple-500/5 border border-purple-500/10 rounded-[24px]">
            <h3 className="text-sm font-bold text-purple-400 mb-2">Ambiente de Testes</h3>
            <p className="text-xs text-slate-400 mb-4">
              Clique no botão abaixo para popular o banco de dados com dados de uma empresa fictícia.
            </p>
            
            {seedSuccess && (
              <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-emerald-400 text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{seedSuccess}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleSeedDb}
              disabled={isSeeding}
              className="w-full py-2.5 mb-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isSeeding ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Populando Banco...</span>
                </>
              ) : (
                <>
                  <Database className="w-4 h-4" />
                  <span>Popular Banco de Dados</span>
                </>
              )}
            </button>

            <div className="space-y-2 text-[11px]">
              <div className="p-2 bg-[#0c1225] border border-white/5 rounded-lg flex justify-between items-center cursor-pointer hover:border-purple-500/30 transition-colors"
                onClick={() => { setEmail('joao@saborescia.com'); setPassword('admin123'); }}
              >
                <div>
                  <p className="text-white font-semibold">joao@saborescia.com</p>
                  <p className="text-slate-500">Gerente (Acesso Total)</p>
                </div>
                <span className="text-slate-400 font-mono">admin123</span>
              </div>
              <div className="p-2 bg-[#0c1225] border border-white/5 rounded-lg flex justify-between items-center cursor-pointer hover:border-purple-500/30 transition-colors"
                onClick={() => { setEmail('maria@saborescia.com'); setPassword('operador123'); }}
              >
                <div>
                  <p className="text-white font-semibold">maria@saborescia.com</p>
                  <p className="text-slate-500">Operadora (PDV)</p>
                </div>
                <span className="text-slate-400 font-mono">operador123</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};