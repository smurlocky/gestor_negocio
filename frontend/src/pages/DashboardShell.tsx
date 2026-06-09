import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import {
  Shield, LayoutDashboard, Users, History, LogOut,
  Plus, Search, Edit3, Trash2, ShieldAlert, CheckCircle, RefreshCw,
  ArrowRight, UserPlus, Package, BookOpen, ShoppingCart,
  Loader2, DollarSign, Receipt, AlertTriangle, TrendingUp,
  Truck, Award, Calendar, Sparkles, TrendingDown
} from 'lucide-react';

import { InsumosStock } from './InsumosStock';
import { ProductsRecipes } from './ProductsRecipes';
import { POSSimulator } from './POSSimulator';
import { SuppliersManagement } from './SuppliersManagement';
import { PurchasesManagement } from './PurchasesManagement';
import { SchedulesManagement } from './SchedulesManagement';
import { AIAnalytics } from './AIAnalytics';

/* ─── Types ────────────────────────────────────── */
interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface AuditLogItem {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string | null;
  record_id: string | null;
  before_state: any;
  after_state: any;
  ip_address: string | null;
  created_at: string;
}

interface DashboardMetrics {
  operation: {
    total_insumos: number;
    total_products: number;
    critical_stock_count: number;
    critical_insumos: Array<{
      id: string;
      name: string;
      unit: string;
      current_stock: number;
      minimum_stock: number;
    }>;
  };
  financial: {
    total_revenue: number;
    orders_count: number;
    average_ticket: number;
  };
}

type TabType = 'overview' | 'stock' | 'products' | 'pos' | 'users' | 'audit' | 'suppliers' | 'purchases' | 'schedules' | 'analytics';

/* ─── Sparkline SVG Components ─────────────────── */
const SparkLine: React.FC<{ color?: string; gradientId: string }> = ({
  color = '#8b5cf6',
  gradientId,
}) => {
  const points = [28, 45, 30, 55, 40, 35, 60, 42, 50, 65, 48, 72, 58, 68, 80];
  const max = Math.max(...points);
  const min = Math.min(...points);
  const w = 200;
  const h = 64;
  const pad = 4;

  const coords = points.map((v, i) => ({
    x: pad + (i / (points.length - 1)) * (w - pad * 2),
    y: pad + ((max - v) / (max - min)) * (h - pad * 2),
  }));

  const pathD = coords
    .map((p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const prev = coords[i - 1];
      const cpx = (prev.x + p.x) / 2;
      return `C ${cpx} ${prev.y} ${cpx} ${p.y} ${p.x} ${p.y}`;
    })
    .join(' ');

  const areaD =
    pathD +
    ` L ${coords[coords.length - 1].x} ${h} L ${coords[0].x} ${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradientId})`} />
      <path d={pathD} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const SparkBars: React.FC<{ color?: string }> = ({ color = '#6366f1' }) => {
  const bars = [4, 7, 5, 9, 6, 11, 8, 13, 10, 15, 12, 14];
  const max = Math.max(...bars);
  return (
    <svg viewBox="0 0 96 56" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      {bars.map((v, i) => {
        const barH = (v / max) * 46;
        const x = i * 8 + 2;
        const y = 52 - barH;
        const opacity = 0.4 + (v / max) * 0.6;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width="5"
            height={barH}
            rx="2"
            fill={color}
            fillOpacity={opacity}
          />
        );
      })}
    </svg>
  );
};

/* ─── Helpers ────────────────────────────────────── */
const getRoleLabel = (role: string) => {
  const map: Record<string, string> = {
    SUPER_ADMIN: 'Super Admin',
    OWNER: 'Proprietário',
    MANAGER: 'Gerente',
    SUPERVISOR: 'Supervisor',
    OPERATOR: 'Operador',
  };
  return map[role] ?? role;
};

const getRoleBadgeClass = (role: string) => {
  const map: Record<string, string> = {
    SUPER_ADMIN: 'bg-red-500/10 text-red-400 border-red-500/20',
    OWNER: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    MANAGER: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    SUPERVISOR: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };
  return map[role] ?? 'bg-slate-500/10 text-slate-400 border-slate-500/20';
};

/* ─── Sidebar Nav Item ────────────────────────────── */
interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  tab: TabType;
  activeTab: TabType;
  onClick: () => void;
  accent?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, tab, activeTab, onClick, accent }) => (
  <button
    onClick={onClick}
    className={`nav-item ${activeTab === tab ? 'active' : ''}`}
  >
    <span className={`flex-shrink-0 ${activeTab === tab ? 'text-violet-400' : accent ? 'text-violet-400' : 'text-slate-500'}`}>
      {icon}
    </span>
    <span className={accent ? 'text-violet-300 font-semibold' : ''}>{label}</span>
  </button>
);

/* ─── Metric Card ─────────────────────────────────── */
interface MetricCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  sparklineType?: 'line' | 'bars';
  sparklineColor?: string;
  gradientId?: string;
  alert?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  iconBg,
  iconColor,
  sparklineType,
  sparklineColor,
  gradientId,
  alert,
}) => (
  <div className={`metric-card p-6 flex flex-col gap-3 min-h-[160px] ${alert ? 'border-amber-500/25 bg-amber-950/10' : ''}`}>
    {/* Top row */}
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-3">
        <span
          className="icon-chip"
          style={{ background: iconBg, border: `1px solid ${iconColor}22` }}
        >
          <span style={{ color: iconColor }}>{icon}</span>
        </span>
        <span className="text-sm font-semibold text-slate-300">{title}</span>
      </div>
      <span className="trend-badge-neutral flex-shrink-0">
        <TrendingUp size={10} />
        +0%
      </span>
    </div>

    {/* Value + Sparkline */}
    <div className="relative flex-1">
      <div className="mt-1">
        <p className="text-[28px] font-bold text-white leading-none" style={{ fontFamily: 'Outfit, sans-serif' }}>
          {value}
        </p>
        <p className="text-xs text-slate-500 mt-2">{subtitle}</p>
      </div>

      {sparklineType === 'line' && sparklineColor && gradientId && (
        <div className="sparkline-wrap">
          <SparkLine color={sparklineColor} gradientId={gradientId} />
        </div>
      )}
      {sparklineType === 'bars' && sparklineColor && (
        <div className="sparkline-wrap" style={{ width: '50%', height: '65%' }}>
          <SparkBars color={sparklineColor} />
        </div>
      )}
    </div>
  </div>
);

/* ─── Tab label map ──────────────────────────────── */
const TAB_TITLES: Record<TabType, string> = {
  overview: 'Visão Geral Operacional',
  stock: 'Estoque & Insumos',
  products: 'Produtos & Ficha Técnica',
  pos: 'Ponto de Venda (PDV)',
  suppliers: 'Gestão de Fornecedores',
  purchases: 'Compras & Recebimento',
  users: 'Gestão de Colaboradores',
  schedules: 'Escalas & Troca de Turnos',
  analytics: 'IA Analytics & Previsões',
  audit: 'Logs de Auditoria',
};

const TAB_SUBTITLES: Record<TabType, string> = {
  overview: 'Acompanhe faturamento bruto, tickets médios e alertas de segurança de estoque crítico.',
  stock: 'Monitore quantidades físicas, estoque mínimo de segurança e movimentações unitárias.',
  products: 'Cadastre o catálogo de venda e gerencie ingredientes com custos integrados de produção.',
  pos: 'Simulador rápido de vendas de caixa para testar o motor de baixa de insumos em tempo real.',
  suppliers: 'Gerencie contatos comerciais e analise históricos de desempenho de seus parceiros.',
  purchases: 'Lance notas de compra em lote, confirme recebimentos e alimente o estoque.',
  users: 'Adicione, edite ou gerencie permissões dos membros do seu time.',
  schedules: 'Gerencie turnos de trabalho, solicite trocas atômicas de escalas e acompanhe afastamentos.',
  analytics: 'Acompanhe previsões de faturamento semanais, reabastecimentos sugeridos e converse com o Copiloto.',
  audit: 'Rastreabilidade total e logs auditáveis de todas as operações críticas.',
};

/* ─── Main Shell ─────────────────────────────────── */
export const DashboardShell: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const [metrics, setMetrics] = useState<DashboardMetrics>({
    operation: { total_insumos: 0, total_products: 0, critical_stock_count: 0, critical_insumos: [] },
    financial: { total_revenue: 0, orders_count: 0, average_ticket: 0 },
  });
  const [metricsLoading, setMetricsLoading] = useState(false);

  const [users, setUsers] = useState<UserItem[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);

  const [showUserModal, setShowUserModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState('OPERATOR');
  const [formIsActive, setFormIsActive] = useState(true);

  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const [stats, setStats] = useState({ userCount: 0, logCount: 0, activeUsers: 0 });

  /* ─── Data fetching ─── */
  const fetchDashboardMetrics = async () => {
    setMetricsLoading(true);
    try {
      const response = await api.get('/dashboard/');
      setMetrics(response.data);
    } catch (err) {
      console.error('Failed to load dashboard metrics', err);
    } finally {
      setMetricsLoading(false);
    }
  };

  const fetchUsers = async () => {
    if (user?.role !== 'OWNER' && user?.role !== 'MANAGER') return;
    setUserLoading(true);
    setUserError(null);
    try {
      const response = await api.get('/users/');
      setUsers(response.data);
      const active = response.data.filter((u: UserItem) => u.is_active).length;
      setStats(prev => ({ ...prev, userCount: response.data.length, activeUsers: active }));
    } catch (err: any) {
      setUserError(err.response?.data?.detail || 'Erro ao carregar colaboradores.');
    } finally {
      setUserLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    if (user?.role !== 'OWNER' && user?.role !== 'MANAGER' && user?.role !== 'SUPERVISOR') return;
    setAuditLoading(true);
    try {
      const response = await api.get('/audit/');
      setAuditLogs(response.data);
      setStats(prev => ({ ...prev, logCount: response.data.length }));
    } catch (err) {
      console.error('Failed to load audit logs', err);
    } finally {
      setAuditLoading(false);
    }
  };

  const refreshAllData = () => {
    fetchDashboardMetrics();
    fetchUsers();
    fetchAuditLogs();
  };

  useEffect(() => {
    if (user) refreshAllData();
  }, [user]);

  /* ─── User CRUD ─── */
  const handleOpenCreateModal = () => {
    setModalMode('create');
    setEditingUserId(null);
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormRole('OPERATOR');
    setFormIsActive(true);
    setShowUserModal(true);
  };

  const handleOpenEditModal = (u: UserItem) => {
    setModalMode('edit');
    setEditingUserId(u.id);
    setFormName(u.name);
    setFormEmail(u.email);
    setFormPassword('');
    setFormRole(u.role);
    setFormIsActive(u.is_active);
    setShowUserModal(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError(null);
    try {
      if (modalMode === 'create') {
        await api.post('/users/', { name: formName, email: formEmail, password: formPassword, role: formRole });
      } else {
        const payload: any = { name: formName, email: formEmail, role: formRole, is_active: formIsActive };
        if (formPassword) payload.password = formPassword;
        await api.put(`/users/${editingUserId}`, payload);
      }
      setShowUserModal(false);
      fetchUsers();
      fetchAuditLogs();
      fetchDashboardMetrics();
    } catch (err: any) {
      setUserError(err.response?.data?.detail || 'Erro ao salvar usuário.');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Tem certeza de que deseja remover este colaborador?')) return;
    setUserError(null);
    try {
      await api.delete(`/users/${userId}`);
      fetchUsers();
      fetchAuditLogs();
      fetchDashboardMetrics();
    } catch (err: any) {
      setUserError(err.response?.data?.detail || 'Erro ao excluir usuário.');
    }
  };

  /* ─── Sidebar nav helper ─── */
  const nav = (tab: TabType, cb?: () => void) => () => {
    setActiveTab(tab);
    cb?.();
  };

  /* ════════════════════════════════════════════════ */
  return (
    <>
      {/* ── Ambient background glows (fora do flex flow) ── */}
      <div
        className="animate-pulse-slow"
        style={{
          position: 'fixed', zIndex: 0, pointerEvents: 'none',
          top: '-15%', left: '15%', width: 600, height: 600,
          background: 'radial-gradient(circle, rgba(99,55,200,0.08) 0%, transparent 70%)',
          borderRadius: '50%', filter: 'blur(40px)',
        }}
      />
      <div
        className="animate-pulse-slow"
        style={{
          position: 'fixed', zIndex: 0, pointerEvents: 'none',
          bottom: '-20%', right: '5%', width: 700, height: 700,
          background: 'radial-gradient(circle, rgba(14,165,233,0.06) 0%, transparent 70%)',
          borderRadius: '50%', filter: 'blur(40px)', animationDelay: '2.5s',
        }}
      />

      {/* ════ ROOT LAYOUT ════ */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          width: '100%',
          height: '100vh',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 1,
        }}
        className="bg-background text-foreground"
      >

        {/* ════ SIDEBAR ════ */}
        <aside
          style={{
            width: '272px',
            minWidth: '272px',
            maxWidth: '272px',
            height: '100%',
            flexShrink: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 10,
          }}
          className="sidebar-glass"
        >
          {/* Logo */}
          <div className="px-5 pt-7 pb-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center gap-3">
              <div
                className="flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0"
                style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)' }}
              >
                <Shield size={18} className="text-violet-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white leading-tight tracking-tight">
                  Gestor<span className="text-violet-400 font-medium">SaaS</span>
                </h2>
                <p className="text-[10px] font-medium tracking-wider uppercase" style={{ color: 'rgba(167,139,250,0.55)' }}>
                  Estoque & Compras
                </p>
              </div>
            </div>
          </div>

          {/* Nav items */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
            <NavItem icon={<LayoutDashboard size={16} />} label="Painel Geral" tab="overview" activeTab={activeTab} onClick={nav('overview', fetchDashboardMetrics)} />
            <NavItem icon={<Package size={16} />} label="Estoque & Insumos" tab="stock" activeTab={activeTab} onClick={nav('stock')} />
            <NavItem icon={<BookOpen size={16} />} label="Produtos & Receitas" tab="products" activeTab={activeTab} onClick={nav('products')} />
            <NavItem icon={<ShoppingCart size={16} />} label="Simulador PDV" tab="pos" activeTab={activeTab} onClick={nav('pos')} />
            <NavItem icon={<Award size={16} />} label="Fornecedores" tab="suppliers" activeTab={activeTab} onClick={nav('suppliers')} />
            <NavItem icon={<Truck size={16} />} label="Compras & Pedidos" tab="purchases" activeTab={activeTab} onClick={nav('purchases')} />
            <NavItem icon={<Calendar size={16} />} label="Escalas & Turnos" tab="schedules" activeTab={activeTab} onClick={nav('schedules')} />
            <NavItem icon={<Sparkles size={16} />} label="IA Analytics" tab="analytics" activeTab={activeTab} onClick={nav('analytics')} accent />

            {(user?.role === 'OWNER' || user?.role === 'MANAGER') && (
              <NavItem icon={<Users size={16} />} label="Colaboradores" tab="users" activeTab={activeTab} onClick={nav('users', fetchUsers)} />
            )}
            {(user?.role === 'OWNER' || user?.role === 'MANAGER' || user?.role === 'SUPERVISOR') && (
              <NavItem icon={<History size={16} />} label="Auditoria" tab="audit" activeTab={activeTab} onClick={nav('audit', fetchAuditLogs)} />
            )}
          </nav>

          {/* User info + Logout */}
          <div className="px-3 pb-5 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center gap-3 px-2 mb-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
              >
                {user?.name?.substring(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate leading-tight">{user?.name}</p>
                <span className={`inline-flex px-2 py-0.5 border rounded-full text-[9px] font-semibold mt-0.5 ${getRoleBadgeClass(user?.role || '')}`}>
                  {getRoleLabel(user?.role || '')}
                </span>
              </div>
            </div>

            <button
              onClick={logout}
              className="nav-item text-red-400 hover:text-red-300 hover:bg-red-500/8 w-full"
              style={{ color: '#f87171' }}
            >
              <LogOut size={15} />
              <span>Sair do Sistema</span>
            </button>
          </div>
        </aside>

        {/* ════ MAIN CONTENT ════ */}
        <main
          style={{
            flex: '1 1 0%',
            width: 0,
            height: '100%',
            overflowY: 'auto',
            overflowX: 'hidden',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* ── Top bar ── */}
          <div
            className="sticky top-0 z-20 flex items-center justify-end px-8 py-3"
            style={{
              background: 'rgba(8,13,26,0.72)',
              backdropFilter: 'blur(16px)',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}
          >
            <span className="tenant-badge">
              ID Tenant&nbsp;
              <span style={{ color: 'rgba(200,210,230,0.5)' }}>
                {user?.tenant_id?.substring(0, 8) || 'Global'}
              </span>
            </span>
          </div>

          {/* ── Page content ── */}
          <div key={activeTab} className="flex-1 p-6 md:p-8 space-y-8 animate-fade-in-up">

            {/* Page header */}
            <div className="flex flex-col gap-3">
              <h1
                className="text-3xl font-bold text-white leading-tight"
                style={{ fontFamily: 'Outfit, sans-serif' }}
              >
                {TAB_TITLES[activeTab]}
              </h1>
              <p className="text-sm" style={{ color: 'rgba(148,163,184,0.8)' }}>
                {TAB_SUBTITLES[activeTab]}
              </p>
              {activeTab === 'overview' && (
                <button
                  className="btn-refresh self-start mt-1"
                  onClick={refreshAllData}
                  disabled={metricsLoading}
                >
                  <RefreshCw size={13} className={metricsLoading ? 'animate-spin' : ''} />
                  Refresh
                </button>
              )}
            </div>

            {/* ══════════════════════════
              TAB: OVERVIEW
          ══════════════════════════ */}
            {activeTab === 'overview' && (
              <div className="space-y-8">
                {metricsLoading ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-500">
                    <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
                    <span className="text-sm">Carregando painel financeiro...</span>
                  </div>
                ) : (
                  <>
                    {/* 2×2 Metrics Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <MetricCard
                        title="Faturamento Bruto"
                        value={`R$ ${metrics.financial.total_revenue.toFixed(2)}`}
                        subtitle="Acumulado em vendas registradas"
                        icon={<DollarSign size={18} />}
                        iconBg="rgba(20,200,120,0.12)"
                        iconColor="#34d399"
                        sparklineType="line"
                        sparklineColor="#34d399"
                        gradientId="spark-revenue"
                      />
                      <MetricCard
                        title="Cupons Emitidos"
                        value={String(metrics.financial.orders_count)}
                        subtitle="Vendas concluídas no caixa"
                        icon={<Receipt size={18} />}
                        iconBg="rgba(99,102,241,0.12)"
                        iconColor="#818cf8"
                        sparklineType="bars"
                        sparklineColor="#818cf8"
                      />
                      <MetricCard
                        title="Ticket Médio"
                        value={`R$ ${metrics.financial.average_ticket.toFixed(2)}`}
                        subtitle="Valor médio por compra"
                        icon={<TrendingUp size={18} />}
                        iconBg="rgba(245,158,11,0.12)"
                        iconColor="#fbbf24"
                        sparklineType="bars"
                        sparklineColor="#34d399"
                      />
                      <MetricCard
                        title="Insumos Críticos"
                        value={String(metrics.operation.critical_stock_count)}
                        subtitle="Abaixo do estoque mínimo de segurança"
                        icon={<AlertTriangle size={18} />}
                        iconBg={metrics.operation.critical_stock_count > 0 ? 'rgba(251,191,36,0.12)' : 'rgba(100,116,139,0.12)'}
                        iconColor={metrics.operation.critical_stock_count > 0 ? '#fbbf24' : '#64748b'}
                        sparklineType="bars"
                        sparklineColor="#f59e0b"
                        alert={metrics.operation.critical_stock_count > 0}
                      />
                    </div>

                    {/* Critical Stock Alerts */}
                    {metrics.operation.critical_stock_count > 0 && (
                      <div
                        className="glass-panel rounded-2xl p-6 space-y-4 animate-fade-in"
                        style={{ borderColor: 'rgba(251,191,36,0.2)', background: 'rgba(120,80,0,0.08)' }}
                      >
                        <div className="flex items-center gap-3">
                          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                          <div>
                            <h4 className="text-sm font-bold text-white">Alertas de Ruptura Crítica</h4>
                            <p className="text-xs text-slate-500 mt-0.5">Os insumos abaixo requerem reposição urgente.</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                          {metrics.operation.critical_insumos.map((i) => (
                            <div
                              key={i.id}
                              className="p-4 rounded-xl text-xs space-y-2 relative overflow-hidden"
                              style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(251,191,36,0.1)' }}
                            >
                              <span
                                className="absolute top-3 right-3 px-1.5 py-0.5 text-amber-400 text-[9px] font-bold rounded"
                                style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}
                              >
                                Crítico
                              </span>
                              <p className="font-semibold text-white truncate pr-10">{i.name}</p>
                              <div className="flex justify-between text-slate-500 pt-1 font-mono text-[11px]">
                                <span>Atual:</span>
                                <span className="text-red-400 font-bold">{i.current_stock.toFixed(2)} {i.unit}</span>
                              </div>
                              <div className="flex justify-between font-mono text-[11px] text-slate-500">
                                <span>Mínimo:</span>
                                <span>{i.minimum_stock.toFixed(2)} {i.unit}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-3 justify-end pt-2">
                          <button
                            onClick={() => setActiveTab('purchases')}
                            className="px-4 py-2 text-xs font-semibold text-violet-300 rounded-xl transition-all inline-flex items-center gap-1.5"
                            style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)' }}
                          >
                            <span>Emitir Pedido</span>
                            <Truck size={13} />
                          </button>
                          <button
                            onClick={() => setActiveTab('stock')}
                            className="px-4 py-2 text-xs font-semibold text-amber-400 rounded-xl transition-all inline-flex items-center gap-1.5"
                            style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.18)' }}
                          >
                            <span>Ver Estoque</span>
                            <ArrowRight size={13} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Module 2 Banner */}
                    <div
                      className="glass-panel rounded-2xl p-7 flex items-start gap-5 relative overflow-hidden"
                      style={{ borderColor: 'rgba(139,92,246,0.12)', background: 'rgba(50,20,100,0.06)' }}
                    >
                      <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full pointer-events-none"
                        style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)', filter: 'blur(20px)' }}
                      />
                      <div
                        className="p-3 rounded-xl text-violet-400 shrink-0"
                        style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}
                      >
                        <Truck size={20} className="animate-float-slow" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-white mb-1.5">Módulo 2: Gestão de Compras Ativada!</h4>
                        <p className="text-sm text-slate-400 leading-relaxed max-w-2xl">
                          Lance pedidos de compras na aba <strong className="text-slate-300">Compras & Pedidos</strong>, associados a parceiros qualificados em <strong className="text-slate-300">Fornecedores</strong>. No recebimento da nota, o estoque é atualizado e o custo médio recalculado automaticamente.
                        </p>
                        <div className="flex flex-wrap gap-3 mt-5">
                          <button
                            onClick={() => setActiveTab('purchases')}
                            className="px-4 py-2 text-xs font-bold text-white rounded-xl flex items-center gap-2 transition-all shadow-lg"
                            style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 8px 24px rgba(124,58,237,0.2)' }}
                          >
                            <span>Registrar Notas de Compra</span>
                            <Truck size={13} />
                          </button>
                          <button
                            onClick={() => setActiveTab('suppliers')}
                            className="px-4 py-2 text-xs font-semibold text-white rounded-xl flex items-center gap-2 transition-all"
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}
                          >
                            <span>Scorecards de Fornecedores</span>
                            <Award size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ══ Other Tabs ══ */}
            {activeTab === 'stock' && <InsumosStock />}
            {activeTab === 'products' && <ProductsRecipes />}
            {activeTab === 'pos' && <POSSimulator />}
            {activeTab === 'suppliers' && <SuppliersManagement />}
            {activeTab === 'purchases' && <PurchasesManagement />}
            {activeTab === 'schedules' && <SchedulesManagement />}
            {activeTab === 'analytics' && <AIAnalytics />}

            {/* ══ Users Tab ══ */}
            {activeTab === 'users' && (
              <div className="space-y-6">
                {userError && (
                  <div className="p-4 rounded-xl flex items-center gap-3 text-sm"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
                    <ShieldAlert size={16} className="text-red-400" />
                    <span>{userError}</span>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="relative max-w-xs flex-1">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Buscar colaborador..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl text-white placeholder-slate-600 text-xs transition-all"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                    />
                  </div>
                  <button
                    onClick={handleOpenCreateModal}
                    className="px-4 py-2.5 text-white font-semibold rounded-xl shadow-lg flex items-center gap-2 text-xs transition-all hover:scale-[1.01]"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 8px 24px rgba(124,58,237,0.2)' }}
                  >
                    <UserPlus size={14} />
                    <span>Cadastrar Colaborador</span>
                  </button>
                </div>

                <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl">
                  {userLoading ? (
                    <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-500">
                      <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
                      <span className="text-sm">Carregando colaboradores...</span>
                    </div>
                  ) : users.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 text-sm">Nenhum colaborador cadastrado.</div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <th className="px-6 py-4">Colaborador</th>
                          <th className="px-6 py-4">E-mail</th>
                          <th className="px-6 py-4">Cargo</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u) => (
                          <tr key={u.id} className="hover:bg-white/[0.01] transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-8 h-8 rounded-full flex items-center justify-center text-violet-400 font-bold text-xs"
                                  style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}
                                >
                                  {u.name.substring(0, 2).toUpperCase()}
                                </div>
                                <span className="text-sm font-medium">{u.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-slate-400">{u.email}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-0.5 border rounded-full text-[10px] font-semibold ${getRoleBadgeClass(u.role)}`}>
                                {getRoleLabel(u.role)}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${u.is_active ? 'text-emerald-400' : 'text-red-400'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                {u.is_active ? 'Ativo' : 'Inativo'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleOpenEditModal(u)}
                                  className="p-2 rounded-xl transition-all text-slate-500 hover:text-white hover:bg-white/5"
                                  title="Editar"
                                >
                                  <Edit3 size={14} />
                                </button>
                                {u.id !== user?.id && (
                                  <button
                                    onClick={() => handleDeleteUser(u.id)}
                                    className="p-2 rounded-xl transition-all text-slate-500 hover:text-red-400 hover:bg-red-500/8"
                                    title="Excluir"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* ══ Audit Tab ══ */}
            {activeTab === 'audit' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">Últimos eventos de auditoria da empresa</span>
                  <button
                    onClick={fetchAuditLogs}
                    disabled={auditLoading}
                    className="btn-refresh"
                  >
                    <RefreshCw size={12} className={auditLoading ? 'animate-spin' : ''} />
                    <span>Atualizar</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {auditLoading ? (
                    <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-500">
                      <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
                      <span className="text-sm">Carregando auditoria...</span>
                    </div>
                  ) : auditLogs.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 text-sm glass-panel rounded-2xl">
                      Nenhum log disponível.
                    </div>
                  ) : (
                    auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="glass-panel p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4"
                        style={{ borderLeft: '3px solid rgba(139,92,246,0.35)' }}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span
                              className="px-2 py-0.5 text-violet-400 text-[10px] font-bold uppercase rounded-md"
                              style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}
                            >
                              {log.action}
                            </span>
                            <span className="text-xs text-slate-500">
                              Tabela: <span className="text-white font-medium">{log.table_name || 'N/A'}</span>
                            </span>
                            {log.ip_address && (
                              <span className="text-xs text-slate-500">
                                IP: <span className="text-white font-mono">{log.ip_address}</span>
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-white">
                            ID: <span className="font-mono text-xs text-slate-400">{log.record_id || 'N/A'}</span>
                          </p>
                          {(log.before_state || log.after_state) && (
                            <div
                              className="mt-2 p-3 rounded-xl text-xs space-y-1.5 max-w-2xl font-mono overflow-x-auto"
                              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)' }}
                            >
                              {log.before_state && (
                                <p className="text-red-400"><span className="font-bold">- Antes:</span> {JSON.stringify(log.before_state)}</p>
                              )}
                              {log.after_state && (
                                <p className="text-emerald-400"><span className="font-bold">+ Depois:</span> {JSON.stringify(log.after_state)}</p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-semibold text-white">{new Date(log.created_at).toLocaleString('pt-BR')}</p>
                          <p className="text-[10px] text-slate-500 mt-1">
                            Actor: {log.user_id ? `User ${log.user_id.substring(0, 8)}` : 'Sistema'}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

          </div>
        </main>

        {/* ════════════════════════════
          USER MODAL
      ════════════════════════════ */}
        {showUserModal && (
          <div className="fixed inset-0 flex items-center justify-center p-4 z-50 animate-fade-in"
            style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}>
            <div className="glass-panel rounded-2xl w-full max-w-md shadow-2xl relative p-8">
              <h3 className="text-lg font-bold text-white mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>
                {modalMode === 'create' ? 'Cadastrar Colaborador' : 'Editar Colaborador'}
              </h3>

              <form onSubmit={handleSaveUser} className="space-y-4">
                {['nome', 'email', 'senha'].map((_, idx) => {
                  if (idx === 0) return (
                    <div key="name">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Nome Completo</label>
                      <input type="text" required placeholder="Nome do Colaborador" value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl text-white placeholder-slate-600 text-sm transition-all" />
                    </div>
                  );
                  if (idx === 1) return (
                    <div key="email">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">E-mail</label>
                      <input type="email" required placeholder="email@empresa.com" value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl text-white placeholder-slate-600 text-sm transition-all" />
                    </div>
                  );
                  return (
                    <div key="pw">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        {modalMode === 'create' ? 'Senha' : 'Nova Senha (deixe em branco para manter)'}
                      </label>
                      <input type="password" required={modalMode === 'create'}
                        placeholder={modalMode === 'create' ? 'Senha secreta' : 'Manter senha atual'} value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl text-white placeholder-slate-600 text-sm transition-all" />
                    </div>
                  );
                })}

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Cargo / Nível de Acesso</label>
                  <select value={formRole} onChange={(e) => setFormRole(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl text-white text-sm transition-all appearance-none">
                    <option value="OPERATOR">Operador</option>
                    <option value="SUPERVISOR">Supervisor</option>
                    <option value="MANAGER">Gerente</option>
                    {user?.role === 'OWNER' && <option value="OWNER">Proprietário</option>}
                  </select>
                </div>

                {modalMode === 'edit' && (
                  <div className="flex items-center gap-3 py-1">
                    <input type="checkbox" id="isActiveCheck" checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      className="w-4 h-4 accent-violet-600" />
                    <label htmlFor="isActiveCheck" className="text-sm font-medium text-white cursor-pointer select-none">
                      Conta Ativa
                    </label>
                  </div>
                )}

                {userError && (
                  <p className="text-xs text-red-400 py-1">{userError}</p>
                )}

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowUserModal(false)}
                    className="flex-1 py-2.5 font-semibold rounded-xl text-xs text-white transition-all"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    Cancelar
                  </button>
                  <button type="submit"
                    className="flex-1 py-2.5 font-semibold rounded-xl text-xs text-white transition-all hover:scale-[1.01]"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 8px 24px rgba(124,58,237,0.2)' }}>
                    Salvar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
