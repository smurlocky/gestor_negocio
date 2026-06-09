import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { 
  Plus, Search, Edit3, Trash2, Loader2, AlertCircle, 
  CheckCircle2, Mail, Phone, User as UserIcon, FileText,
  Star, Award, Calendar, DollarSign, BarChart3, X, Info
} from 'lucide-react';

interface SupplierItem {
  id: string;
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  contact_name: string | null;
  created_at: string;
}

interface PerformanceData {
  average_delivery_days: number | null;
  average_quality_rating: number | null;
  average_price_rating: number | null;
  total_purchases_value: number;
  purchase_orders_count: number;
}

export const SuppliersManagement: React.FC = () => {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Search
  const [searchTerm, setSearchTerm] = useState('');

  // Modal Supplier Profile CRUD States
  const [showFormModal, setShowFormModal] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formDocument, setFormDocument] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formContactName, setFormContactName] = useState('');

  // Scorecard / Performance States
  const [selectedSupplierForPerformance, setSelectedSupplierForPerformance] = useState<SupplierItem | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);

  const fetchSuppliers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/suppliers/');
      setSuppliers(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao carregar parceiros e fornecedores.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const triggerSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 4000);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const payload = {
        name: formName,
        document: formDocument || null,
        phone: formPhone || null,
        email: formEmail || null,
        contact_name: formContactName || null
      };

      if (formMode === 'create') {
        await api.post('/suppliers/', payload);
        triggerSuccess('Fornecedor parceiro cadastrado com sucesso!');
      } else {
        await api.put(`/suppliers/${editingId}`, payload);
        triggerSuccess('Cadastro do fornecedor atualizado com sucesso!');
      }

      setShowFormModal(false);
      fetchSuppliers();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao salvar fornecedor. Verifique permissões.');
    }
  };

  const handleDeleteSupplier = async (id: string) => {
    if (!window.confirm('Tem certeza de que deseja excluir este parceiro fornecedor?')) return;
    setError(null);
    try {
      await api.delete(`/suppliers/${id}`);
      triggerSuccess('Fornecedor removido com sucesso!');
      fetchSuppliers();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao remover parceiro fornecedor.');
    }
  };

  const handleOpenPerformance = async (s: SupplierItem) => {
    setSelectedSupplierForPerformance(s);
    setPerformanceLoading(true);
    setPerformanceData(null);
    try {
      const res = await api.get(`/suppliers/${s.id}/performance`);
      setPerformanceData(res.data);
    } catch (err) {
      console.error('Falha ao obter scorecards do fornecedor', err);
    } finally {
      setPerformanceLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setFormMode('create');
    setEditingId(null);
    setFormName('');
    setFormDocument('');
    setFormPhone('');
    setFormEmail('');
    setFormContactName('');
    setShowFormModal(true);
  };

  const handleOpenEditModal = (s: SupplierItem) => {
    setFormMode('edit');
    setEditingId(s.id);
    setFormName(s.name);
    setFormDocument(s.document || '');
    setFormPhone(s.phone || '');
    setFormEmail(s.email || '');
    setFormContactName(s.contact_name || '');
    setShowFormModal(true);
  };

  const renderStars = (rating: number | null) => {
    if (rating === null) return <span className="text-muted-foreground text-xs italic">Sem avaliação</span>;
    
    const stars = [];
    const rounded = Math.round(rating);
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star 
          key={i} 
          className={`w-3.5 h-3.5 ${i <= rounded ? 'text-amber-400 fill-amber-400' : 'text-white/10'}`} 
        />
      );
    }
    return (
      <div className="flex items-center gap-1">
        {stars}
        <span className="text-xs font-bold text-white ml-1">{rating.toFixed(1)}</span>
      </div>
    );
  };

  // Filter List
  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.contact_name && s.contact_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const isMutateAllowed = user?.role === 'OWNER' || user?.role === 'MANAGER';

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

      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative max-w-xs flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar fornecedores parceiros..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-2xl text-white placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-xs transition-all"
          />
        </div>

        {isMutateAllowed && (
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-2xl shadow-lg shadow-purple-900/10 flex items-center gap-2 text-xs transition-all hover:scale-[1.01]"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Fornecedor</span>
          </button>
        )}
      </div>

      {/* Suppliers Card Grid */}
      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-500 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
          <span className="text-sm">Carregando parceiros comerciais...</span>
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="p-12 text-center text-slate-500 text-sm rounded-2xl"
          style={{ border: '1px dashed rgba(255,255,255,0.08)' }}>
          Nenhum fornecedor parceiro cadastrado.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSuppliers.map((s) => (
            <div key={s.id} className="p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between group transition-all duration-300"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.25)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-500/[0.02] to-indigo-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />

              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h4 className="text-base font-bold text-white group-hover:text-purple-400 transition-colors truncate max-w-[200px]">
                      {s.name}
                    </h4>
                    {s.document && (
                      <span className="text-[9px] font-mono text-muted-foreground block mt-0.5">CNPJ: {s.document}</span>
                    )}
                  </div>
                  
                  <button
                    onClick={() => handleOpenPerformance(s)}
                    className="p-1.5 bg-purple-600/10 hover:bg-purple-600/20 active:bg-purple-600/30 text-purple-400 border border-purple-500/15 rounded-xl transition-all flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>Desempenho</span>
                  </button>
                </div>

                {/* Contact profiles */}
                <div className="space-y-2 py-4 border-y border-white/5 mb-6 text-xs text-muted-foreground">
                  {s.contact_name && (
                    <div className="flex items-center gap-2">
                      <UserIcon className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span className="truncate text-white">{s.contact_name}</span>
                    </div>
                  )}

                  {s.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span className="truncate font-mono">{s.phone}</span>
                    </div>
                  )}

                  {s.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span className="truncate font-mono">{s.email}</span>
                    </div>
                  )}

                  {!s.contact_name && !s.phone && !s.email && (
                    <p className="italic text-[11px]">Sem dados adicionais de contato.</p>
                  )}
                </div>
              </div>

              {isMutateAllowed ? (
                <div className="flex gap-2.5 pt-2">
                  <button
                    onClick={() => handleOpenEditModal(s)}
                    className="flex-1 py-2 bg-white/5 hover:bg-white/10 active:bg-white/20 border border-white/5 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1 transition-all"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Editar Ficha</span>
                  </button>

                  <button
                    onClick={() => handleDeleteSupplier(s.id)}
                    className="p-2 hover:bg-red-500/10 active:bg-red-500/20 text-muted-foreground hover:text-red-400 rounded-xl border border-transparent hover:border-red-500/10 transition-all"
                    title="Excluir fornecedor"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="text-[10px] text-center text-muted-foreground italic pt-2">
                  Edição restrita a gerentes.
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT SUPPLIER FORM MODAL */}
      {showFormModal && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)' }}>
          <div className="p-8 rounded-2xl w-full max-w-md shadow-2xl relative"
            style={{ background: 'rgba(10,14,26,0.95)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              onClick={() => setShowFormModal(false)}
              className="absolute top-6 right-6 p-2 bg-white/5 border border-white/5 hover:bg-white/10 rounded-full text-muted-foreground hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-bold text-white mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
              {formMode === 'create' ? 'Cadastrar Fornecedor' : 'Editar Cadastro'}
            </h3>
            <p className="text-xs text-muted-foreground mb-6">Cadastre parceiros para emissão de pedidos de compras.</p>

            <form onSubmit={handleSaveSupplier} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Razão Social / Nome Fantasia
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Distribuidora de Alimentos Silva Ltda."
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-2xl text-white placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  CNPJ ou CPF (Documento Comercial)
                </label>
                <input
                  type="text"
                  placeholder="Ex: 00.000.000/0001-00"
                  value={formDocument}
                  onChange={(e) => setFormDocument(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-2xl text-white placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-sm transition-all font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Telefone
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: (11) 98765-4321"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-2xl text-white placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-sm transition-all font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Nome do Contato
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Paulo Vendedor"
                    value={formContactName}
                    onChange={(e) => setFormContactName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-2xl text-white placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-sm transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  E-mail do Fornecedor
                </label>
                <input
                  type="email"
                  placeholder="vendas@fornecedor.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-2xl text-white placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-sm transition-all font-mono"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 active:bg-white/20 border border-white/5 text-white font-semibold rounded-2xl text-xs transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-2xl text-xs shadow-lg shadow-purple-900/10 transition-all"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUPPLIER SCORECARD / PERFORMANCE ANALYTICS MODAL */}
      {selectedSupplierForPerformance && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)' }}>
          <div className="p-8 rounded-2xl w-full max-w-lg shadow-2xl relative overflow-hidden"
            style={{ background: 'rgba(10,14,26,0.95)', border: '1px solid rgba(139,92,246,0.15)' }}>
            <div className="absolute -top-12 -right-12 w-36 h-36 bg-purple-500/5 rounded-full blur-xl" />
            
            <button
              onClick={() => setSelectedSupplierForPerformance(null)}
              className="absolute top-6 right-6 p-2 bg-white/5 border border-white/5 hover:bg-white/10 rounded-full text-muted-foreground hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
              <Award className="w-6 h-6 text-purple-400" />
              <span>Scorecard de Desempenho</span>
            </h3>
            <p className="text-xs text-muted-foreground mb-8">
              Métricas consolidadas sobre o parceiro: <strong className="text-white">{selectedSupplierForPerformance.name}</strong>
            </p>

            {performanceLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                <span className="text-xs">Consolidando avaliações de compras...</span>
              </div>
            ) : performanceData ? (
              <div className="space-y-6">
                
                {/* Visual scorecard stats grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-black/40 border border-white/5 rounded-2xl relative overflow-hidden">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Faturado</span>
                    <p className="text-lg font-extrabold text-white mt-2 font-mono">
                      R$ {performanceData.total_purchases_value.toFixed(2)}
                    </p>
                    <div className="absolute bottom-3 right-3 opacity-15"><DollarSign className="w-8 h-8 text-white" /></div>
                  </div>

                  <div className="p-4 bg-black/40 border border-white/5 rounded-2xl relative overflow-hidden">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Compras Concluídas</span>
                    <p className="text-lg font-extrabold text-white mt-2">
                      {performanceData.purchase_orders_count} pedidos
                    </p>
                    <div className="absolute bottom-3 right-3 opacity-15"><FileText className="w-8 h-8 text-white" /></div>
                  </div>
                </div>

                <div className="p-5 bg-white/[0.01] border border-white/5 rounded-2xl space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400">Avaliações das Entregas</h4>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-purple-400 shrink-0" />
                        Prazo de Entrega Médio:
                      </span>
                      <span className="text-xs font-bold text-white font-mono">
                        {performanceData.average_delivery_days !== null 
                          ? `${performanceData.average_delivery_days.toFixed(1)} dias corridos`
                          : 'Sem histórico'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-t border-white/5 pt-3">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Star className="w-4 h-4 text-amber-400 shrink-0" />
                        Qualidade dos Materiais:
                      </span>
                      {renderStars(performanceData.average_quality_rating)}
                    </div>

                    <div className="flex justify-between items-center py-1 border-t border-white/5 pt-3">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-emerald-400 shrink-0" />
                        Custo comercial / Preço:
                      </span>
                      {renderStars(performanceData.average_price_rating)}
                    </div>
                  </div>
                </div>

                {performanceData.purchase_orders_count === 0 && (
                  <div className="p-3 bg-white/5 border border-white/5 rounded-2xl flex items-center gap-2.5 text-[10px] text-muted-foreground">
                    <Info className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>Nenhum pedido de compra concluído com este fornecedor ainda. Lançamentos pendentes não alimentam o scorecard de performance.</span>
                  </div>
                )}

              </div>
            ) : (
              <p className="text-center text-xs text-muted-foreground">Falha ao consolidar dados.</p>
            )}

            <div className="mt-8 pt-4 border-t border-white/5 text-right">
              <button
                onClick={() => setSelectedSupplierForPerformance(null)}
                className="px-6 py-2 bg-white/5 hover:bg-white/10 text-xs font-semibold text-white rounded-xl transition-all"
              >
                Fechar Ficha
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
