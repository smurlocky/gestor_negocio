import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Building2, User, Mail, Lock, ArrowRight, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';

export const RegisterTenant: React.FC = () => {
  const { registerTenant } = useAuth();
  const navigate = useNavigate();

  const [companyName, setCompanyName] = useState('');
  const [slug, setSlug] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const [showPassword, setShowPassword] = useState(false);
  const [companyTouched, setCompanyTouched] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  // Auto-generate slug from company name
  const handleCompanyNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCompanyName(value);
    setCompanyTouched(true);
    setSlugTouched(true);
    
    // Convert to lowcase, remove accents, remove spaces, only keep letters, numbers, and dashes
    const generatedSlug = value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove accents
      .replace(/[^a-z0-9\s-]/g, '') // remove illegal chars
      .trim()
      .replace(/\s+/g, '-') // spaces to dashes
      .replace(/-+/g, '-'); // duplicate dashes to single
    
    setSlug(generatedSlug);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !slug || !adminName || !adminEmail || !adminPassword) return;

    setError(null);
    setIsLoading(true);

    try {
      await registerTenant({
        company_name: companyName,
        slug,
        admin_name: adminName,
        admin_email: adminEmail,
        admin_password: adminPassword
      });
      navigate('/');
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        const errorMessages = detail.map((d: any) => {
          const field = d.loc[d.loc.length - 1];
          const fieldLabel: Record<string, string> = {
            company_name: 'Nome da Empresa',
            slug: 'Identificador Slug',
            admin_name: 'Seu Nome',
            admin_email: 'E-mail',
            admin_password: 'Senha de Acesso'
          };
          const label = fieldLabel[field] || field;
          let msg = d.msg;
          if (msg.includes('at least 6 characters')) {
            msg = 'deve ter pelo menos 6 caracteres';
          } else if (msg.includes('at least 2 characters')) {
            msg = 'deve ter pelo menos 2 caracteres';
          } else if (msg.includes('valid email address')) {
            msg = 'deve ser um e-mail válido';
          }
          return `${label}: ${msg}`;
        });
        setError(errorMessages.join(', '));
      } else if (typeof detail === 'string') {
        setError(detail);
      } else {
        setError('Erro ao registrar empresa. Tente outro identificador slug ou e-mail.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      {/* Background glow animations */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full filter blur-[100px] animate-pulse-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full filter blur-[100px] animate-pulse-glow" style={{ animationDelay: '1.5s' }} />

      <div className="w-full max-w-lg z-10 my-8">
        {/* Brand header */}
        <div className="flex flex-col items-center mb-6">
          <div className="p-3 bg-purple-600/10 border border-purple-500/20 rounded-2xl mb-4 shadow-lg shadow-purple-900/10">
            <Shield className="w-8 h-8 text-purple-400 animate-pulse" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
            Gestor<span className="text-purple-400 font-medium">SaaS</span>
          </h1>
          <p className="text-sm text-muted-foreground text-center">
            Abra a conta do seu negócio em segundos
          </p>
        </div>

        {/* Glassmorphic Register Card */}
        <div className="glass-panel p-8 rounded-3xl shadow-2xl relative overflow-hidden">
          <h2 className="text-xl font-semibold text-white mb-6">Cadastre sua Empresa</h2>

          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-2xl flex items-start gap-3 text-destructive-foreground text-sm">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Nome da Empresa
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Minha Pizzaria"
                    value={companyName}
                    onChange={handleCompanyNameChange}
                    onBlur={() => setCompanyTouched(true)}
                    disabled={isLoading}
                    className={`w-full pl-11 pr-4 py-3 bg-white/5 border rounded-2xl text-white placeholder-muted-foreground focus:outline-none focus:ring-2 transition-all text-sm ${
                      companyTouched && companyName.length < 6
                        ? 'border-rose-500/40 focus:border-rose-500/50 focus:ring-rose-500/10'
                        : companyTouched && companyName.length >= 6
                        ? 'border-emerald-500/30 focus:border-emerald-500/45 focus:ring-emerald-500/10'
                        : 'border-white/5 focus:border-purple-500/30 focus:ring-purple-500/20'
                    }`}
                  />
                </div>
                {companyTouched && companyName.length < 6 && (
                  <p className="text-[11px] text-rose-400/80 mt-1.5 flex items-center gap-1 font-sans">
                    <span>●</span> Mínimo de 6 caracteres
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Slug Identificador
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="minha-pizzaria"
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.target.value);
                      setSlugTouched(true);
                    }}
                    onBlur={() => setSlugTouched(true)}
                    disabled={isLoading}
                    className={`w-full px-4 py-3 bg-white/5 border rounded-2xl text-white placeholder-muted-foreground focus:outline-none focus:ring-2 transition-all text-sm font-mono ${
                      slugTouched && slug.length < 2
                        ? 'border-rose-500/40 focus:border-rose-500/50 focus:ring-rose-500/10'
                        : slugTouched && slug.length >= 2
                        ? 'border-emerald-500/30 focus:border-emerald-500/45 focus:ring-emerald-500/10'
                        : 'border-white/5 focus:border-purple-500/30 focus:ring-purple-500/20'
                    }`}
                  />
                </div>
                {slugTouched && slug.length < 2 && (
                  <p className="text-[11px] text-rose-400/80 mt-1.5 flex items-center gap-1 font-sans">
                    <span>●</span> Mínimo de 2 caracteres
                  </p>
                )}
              </div>
            </div>

            <div className="border-t border-white/5 pt-5 my-2">
              <h3 className="text-sm font-semibold text-white/70 mb-4">Dados do Proprietário</h3>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Seu Nome Completo
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                  <User className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  required
                  placeholder="Seu Nome"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  disabled={isLoading}
                  className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-2xl text-white placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                E-mail Administrativo
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  type="email"
                  required
                  placeholder="admin@empresa.com"
                  value={adminEmail}
                  onChange={(e) => {
                    setAdminEmail(e.target.value);
                    setEmailTouched(true);
                  }}
                  onBlur={() => setEmailTouched(true)}
                  disabled={isLoading}
                  className={`w-full pl-11 pr-4 py-3 bg-white/5 border rounded-2xl text-white placeholder-muted-foreground focus:outline-none focus:ring-2 transition-all text-sm ${
                    emailTouched && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)
                      ? 'border-rose-500/40 focus:border-rose-500/50 focus:ring-rose-500/10'
                      : emailTouched && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)
                      ? 'border-emerald-500/30 focus:border-emerald-500/45 focus:ring-emerald-500/10'
                      : 'border-white/5 focus:border-purple-500/30 focus:ring-purple-500/20'
                  }`}
                />
              </div>
              {emailTouched && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail) && (
                <p className="text-[11px] text-rose-400/80 mt-1.5 flex items-center gap-1">
                  <span>●</span> Insira um formato de e-mail válido
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Sua Senha de Acesso
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Mínimo de 6 caracteres"
                  value={adminPassword}
                  onChange={(e) => {
                    setAdminPassword(e.target.value);
                    setPasswordTouched(true);
                  }}
                  onBlur={() => setPasswordTouched(true)}
                  disabled={isLoading}
                  className={`w-full pl-11 pr-10 py-3 bg-white/5 border rounded-2xl text-white placeholder-muted-foreground focus:outline-none focus:ring-2 transition-all text-sm ${
                    passwordTouched && adminPassword.length < 6
                      ? 'border-rose-500/40 focus:border-rose-500/50 focus:ring-rose-500/10'
                      : passwordTouched && adminPassword.length >= 6
                      ? 'border-emerald-500/30 focus:border-emerald-500/45 focus:ring-emerald-500/10'
                      : 'border-white/5 focus:border-purple-500/30 focus:ring-purple-500/20'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted-foreground hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {passwordTouched && adminPassword.length < 6 && (
                <p className="text-[11px] text-rose-400/80 mt-1.5 flex items-center gap-1">
                  <span>●</span> A senha deve ter pelo menos 6 caracteres
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:from-purple-700 active:to-indigo-700 text-white font-semibold rounded-2xl shadow-xl shadow-purple-900/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100 disabled:active:scale-100"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Cadastrando Empresa...</span>
                </>
              ) : (
                <>
                  <span>Cadastrar e Iniciar</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/5 text-center text-sm text-muted-foreground">
            Já possui uma empresa cadastrada?{' '}
            <Link to="/login" className="text-purple-400 hover:text-purple-300 font-medium transition-colors">
              Efetuar Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
