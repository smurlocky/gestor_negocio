import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { 
  Plus, Search, Edit3, Trash2, Loader2, AlertCircle, 
  CheckCircle2, DollarSign, Calendar, FileText, Star,
  Truck, Clipboard, Layers, User as UserIcon, X, Check,
  ChevronRight, Award
} from 'lucide-react';

interface InsumoItem {
  id: string;
  name: string;
  unit: string;
}

interface SupplierItem {
  id: string;
  name: string;
}

interface PurchaseItem {
  id: string;
  insumo_id: string;
  quantity: number;
  unit_cost: number;
  insumo?: InsumoItem;
}

interface PurchaseOrder {
  id: string;
  supplier_id: string;
  status: string;
  total_price: number;
  delivery_days: number | null;
  quality_rating: number | null;
  price_rating: number | null;
  created_at: string;
  updated_at: string;
  items: PurchaseItem[];
  supplier?: SupplierItem;
}

export const PurchasesManagement: React.FC = () => {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [insumos, setInsumos] = useState<InsumoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Search filter
  const [searchTerm, setSearchTerm] = useState('');

  // CREATE Form Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  
  // Dynamic Items inside creating form
  const [formItems, setFormItems] = useState<{ insumo_id: string; quantity: number; unit_cost: number }[]>([]);
  const [insumoToAdd, setInsumoToAdd] = useState('');
  const [qtyToAdd, setQtyToAdd] = useState('');
  const [costToAdd, setCostToAdd] = useState('');

  // EVALUATE & COMPLETE Modal States
  const [showEvaluateModal, setShowEvaluateModal] = useState(false);
  const [orderToEvaluate, setOrderToEvaluate] = useState<PurchaseOrder | null>(null);
  const [evalDeliveryDays, setEvalDeliveryDays] = useState('1');
  const [evalQuality, setEvalQuality] = useState(5);
  const [evalPrice, setEvalPrice] = useState(5);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Detail Modal States
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<PurchaseOrder | null>(null);

  const fetchPurchases = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/purchases/');
      setPurchases(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao carregar histórico de compras.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliersAndInsumos = async () => {
    try {
      const supRes = await api.get('/suppliers/');
      setSuppliers(supRes.data);

      const insRes = await api.get('/insumos/');
      setInsumos(insRes.data);
    } catch (err) {
      console.error('Falha ao obter lista de fornecedores/insumos', err);
    }
  };

  useEffect(() => {
    fetchPurchases();
    fetchSuppliersAndInsumos();
  }, []);

  const triggerSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 5000);
  };

  // Add Item to dynamic form list
  const handleAddItemToForm = () => {
    if (!insumoToAdd) return;
    const qty = parseFloat(qtyToAdd);
    const cost = parseFloat(costToAdd);

    if (isNaN(qty) || qty <= 0 || isNaN(cost) || cost < 0) {
      alert('Informe uma quantidade e custo válidos.');
      return;
    }

    // Check if already in form, accumulate
    const idx = formItems.findIndex(i => i.insumo_id === insumoToAdd);
    if (idx > -1) {
      const updated = [...formItems];
      updated[idx].quantity += qty;
      updated[idx].unit_cost = cost; // Keep the newest cost
      setFormItems(updated);
    } else {
      setFormItems([...formItems, { insumo_id: insumoToAdd, quantity: qty, unit_cost: cost }]);
    }

    setInsumoToAdd('');
    setQtyToAdd('');
    setCostToAdd('');
  };

  const handleRemoveItemFromForm = (idx: number) => {
    const updated = [...formItems];
    updated.splice(idx, 1);
    setFormItems(updated);
  };

  const currentFormTotal = formItems.reduce((acc, item) => acc + (item.quantity * item.unit_cost), 0);

  // Submit new PENDING purchase order
  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedSupplierId) {
      alert('Selecione um fornecedor.');
      return;
    }

    if (formItems.length === 0) {
      alert('Adicione pelo menos um insumo no pedido de compra.');
      return;
    }

    try {
      const payload = {
        supplier_id: selectedSupplierId,
        items: formItems.map(item => ({
          insumo_id: item.insumo_id,
          quantity: item.quantity,
          unit_cost: item.unit_cost
        }))
      };

      await api.post('/purchases/', payload);
      triggerSuccess('Pedido de Compra registrado no status PENDENTE! Prontificado para recebimento físico.');
      
      setShowCreateModal(false);
      fetchPurchases();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao registrar pedido de compra.');
    }
  };

  // Cancel order (status -> CANCELLED)
  const handleCancelOrder = async (id: string) => {
    if (!window.confirm('Deseja realmente CANCELAR este pedido de compra?')) return;
    setError(null);
    try {
      await api.put(`/purchases/${id}`, { status: 'CANCELLED' });
      triggerSuccess('Pedido de compra CANCELADO com sucesso.');
      fetchPurchases();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao cancelar pedido.');
    }
  };

  // Open complete/evaluate modal
  const handleOpenEvaluate = (order: PurchaseOrder) => {
    setOrderToEvaluate(order);
    setEvalDeliveryDays('1');
    setEvalQuality(5);
    setEvalPrice(5);
    setShowEvaluateModal(true);
  };

  // Submit evaluate & COMPLETE order
  const handleSubmitComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderToEvaluate) return;

    setSubmitLoading(true);
    setError(null);
    try {
      const payload = {
        status: 'COMPLETED',
        delivery_days: parseInt(evalDeliveryDays) || 0,
        quality_rating: evalQuality,
        price_rating: evalPrice
      };

      await api.put(`/purchases/${orderToEvaluate.id}`, payload);
      
      triggerSuccess('Entrada de Compra CONCLUÍDA! Estoque abastecido e custo médio ponderado atualizado automaticamente!');
      setShowEvaluateModal(false);
      fetchPurchases();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao concluir recebimento da compra.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING': 
        return { label: 'Pendente', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20 animate-pulse' };
      case 'COMPLETED': 
        return { label: 'Concluído', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
      case 'CANCELLED': 
        return { label: 'Cancelado', color: 'text-red-400 bg-red-500/10 border-red-500/20' };
      default: 
        return { label: status, color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' };
    }
  };

  const getInsumoDetails = (insumoId: string) => {
    return insumos.find(i => i.id === insumoId);
  };

  // Filter purchases list
  const filteredPurchases = purchases.filter(p => {
    const matchesSearch = p.supplier?.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const isOperator = user?.role === 'OPERATOR';

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
            placeholder="Buscar nota ou fornecedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-2xl text-white placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-xs transition-all"
          />
        </div>

        {!isOperator && (
          <button
            onClick={() => {
              setSelectedSupplierId('');
              setFormItems([]);
              setInsumoToAdd('');
              setQtyToAdd('');
              setCostToAdd('');
              setShowCreateModal(true);
            }}
            className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-2xl shadow-lg shadow-purple-900/10 flex items-center gap-2 text-xs transition-all hover:scale-[1.01]"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Pedido de Compra</span>
          </button>
        )}
      </div>

      {/* Main Purchases Table */}
      <div className="rounded-2xl overflow-hidden shadow-xl" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
            <span className="text-sm">Carregando histórico de suprimentos...</span>
          </div>
        ) : filteredPurchases.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">Nenhum pedido de compra registrado.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Código</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Fornecedor</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Data</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Total</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredPurchases.map((p) => {
                const statusInfo = getStatusBadge(p.status);
                return (
                  <tr key={p.id} className="hover:bg-white/[0.01] transition-colors text-xs">
                    <td className="px-6 py-4 font-mono font-bold text-white">
                      #{p.id.substring(0, 8)}
                    </td>
                    <td className="px-6 py-4 font-semibold text-white">
                      {p.supplier?.name || 'Fornecedor Excluído'}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 font-bold text-white font-mono">
                      R$ {p.total_price.toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 border rounded-full text-[10px] font-semibold ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedOrderForDetail(p)}
                          className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 active:bg-white/20 border border-white/5 rounded-xl transition-all font-semibold"
                        >
                          Ver Detalhes
                        </button>

                        {p.status === 'PENDING' && !isOperator && (
                          <>
                            <button
                              onClick={() => handleOpenEvaluate(p)}
                              className="px-2.5 py-1.5 bg-purple-600/10 hover:bg-purple-600/20 active:bg-purple-600/30 text-purple-400 hover:text-purple-300 border border-purple-500/20 rounded-xl transition-all font-bold flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Receber Nota</span>
                            </button>

                            <button
                              onClick={() => handleCancelOrder(p.id)}
                              className="p-1.5 hover:bg-red-500/10 text-muted-foreground hover:text-red-400 rounded-xl transition-all"
                              title="Cancelar Pedido"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* CREATE PURCHASE ORDER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)' }}>
          <div className="p-8 rounded-2xl w-full max-w-4xl shadow-2xl relative my-8"
            style={{ background: 'rgba(10,14,26,0.95)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <button onClick={() => setShowCreateModal(false)}
              className="absolute top-6 right-6 p-2 bg-white/5 border border-white/5 hover:bg-white/10 rounded-full text-slate-500 hover:text-white transition-all">
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-xl font-bold text-white mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>Registrar Entrada de Compra</h3>
            <p className="text-xs text-muted-foreground mb-8">
              Monte o pedido de compra. Após recebimento físico, você avaliará o fornecedor para liberar as mercadorias no estoque.
            </p>

            <form onSubmit={handleCreatePurchase} className="grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* LEFT: Supplier Select */}
              <div className="md:col-span-4 space-y-4">
                <div className="p-5 bg-white/[0.01] border border-white/5 rounded-2xl space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400">Fornecedor Responsável</h4>
                  
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Selecione o Parceiro
                    </label>
                    <select
                      required
                      value={selectedSupplierId}
                      onChange={(e) => setSelectedSupplierId(e.target.value)}
                      className="w-full px-3 py-2 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-xl text-white focus:outline-none text-xs appearance-none"
                    >
                      <option value="" className="bg-slate-900 text-muted-foreground">Selecione...</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id} className="bg-slate-900 text-white">{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Pricing Summary */}
                <div className="p-5 bg-purple-950/5 border border-purple-500/10 rounded-2xl space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400">Consolidação de Custos</h4>
                  <div className="flex justify-between text-xs pt-1">
                    <span className="text-muted-foreground">Insumos diferentes:</span>
                    <span className="text-white font-semibold">{formItems.length}</span>
                  </div>
                  <div className="flex justify-between text-sm font-extrabold border-t border-white/5 pt-3">
                    <span className="text-white">Total Fatura:</span>
                    <span className="text-white font-mono text-base">R$ {currentFormTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* RIGHT: Dynamic items builder */}
              <div className="md:col-span-8 space-y-4">
                <div className="p-5 bg-white/[0.01] border border-white/5 rounded-2xl space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400">Cesta de Suprimentos</h4>
                  
                  {/* Dynamic Items bar inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-4 bg-white/[0.01] border border-white/5 rounded-xl items-end text-xs">
                    <div className="sm:col-span-5">
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Insumo do Estoque
                      </label>
                      <select
                        value={insumoToAdd}
                        onChange={(e) => setInsumoToAdd(e.target.value)}
                        className="w-full px-3 py-2 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-xl text-white focus:outline-none text-xs appearance-none"
                      >
                        <option value="" className="bg-slate-900 text-muted-foreground">Selecione...</option>
                        {insumos.map((i) => (
                          <option key={i.id} value={i.id} className="bg-slate-900 text-white">{i.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Qtd. Comprada ({insumoToAdd ? getInsumoDetails(insumoToAdd)?.unit : ''})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={qtyToAdd}
                        onChange={(e) => setQtyToAdd(e.target.value)}
                        className="w-full px-3 py-2 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-xl text-white focus:outline-none text-xs font-mono"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Custo Unitário (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={costToAdd}
                        onChange={(e) => setCostToAdd(e.target.value)}
                        className="w-full px-3 py-2 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-xl text-white focus:outline-none text-xs font-mono"
                      />
                    </div>

                    <div className="sm:col-span-1">
                      <button
                        type="button"
                        onClick={handleAddItemToForm}
                        className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold flex items-center justify-center"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* items table list */}
                  <div className="border border-white/5 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                    {formItems.length === 0 ? (
                      <p className="p-8 text-center text-xs text-muted-foreground italic">Cesta de compras vazia.</p>
                    ) : (
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-white/5 bg-white/[0.02] text-muted-foreground uppercase text-[9px]">
                            <th className="px-4 py-2">Insumo</th>
                            <th className="px-4 py-2">Qtd.</th>
                            <th className="px-4 py-2">Custo Unitário</th>
                            <th className="px-4 py-2">Subtotal</th>
                            <th className="px-4 py-2 text-right">Ação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {formItems.map((item, idx) => {
                            const ins = getInsumoDetails(item.insumo_id);
                            return (
                              <tr key={item.insumo_id} className="hover:bg-white/[0.01]">
                                <td className="px-4 py-2.5 font-semibold text-white">{ins?.name || 'Insumo'}</td>
                                <td className="px-4 py-2.5 font-mono text-white">{item.quantity} {ins?.unit}</td>
                                <td className="px-4 py-2.5 font-mono text-muted-foreground">R$ {item.unit_cost.toFixed(2)}</td>
                                <td className="px-4 py-2.5 font-mono font-bold text-white">R$ {(item.quantity * item.unit_cost).toFixed(2)}</td>
                                <td className="px-4 py-2.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItemFromForm(idx)}
                                    className="p-1 hover:text-red-400 rounded-lg"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                <div className="flex gap-4 pt-4 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 text-white font-semibold rounded-2xl text-xs transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-2xl text-xs shadow-lg shadow-purple-900/10 transition-all"
                  >
                    Confirmar Pedido Pendente
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* EVALUATE AND RECEIVE NOTE MODAL (COMPLETE TRIGGER) */}
      {showEvaluateModal && orderToEvaluate && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)' }}>
          <div className="p-8 rounded-2xl w-full max-w-md shadow-2xl relative"
            style={{ background: 'rgba(10,14,26,0.95)', border: '1px solid rgba(139,92,246,0.2)' }}>
            <button
              onClick={() => setShowEvaluateModal(false)}
              className="absolute top-6 right-6 p-2 bg-white/5 border border-white/5 hover:bg-white/10 rounded-full text-muted-foreground hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-1.5">
              <Truck className="w-6 h-6 text-purple-400" />
              <span>Confirmar Recebimento</span>
            </h3>
            <p className="text-xs text-muted-foreground mb-6">
              Pedido <strong className="text-white">#{orderToEvaluate.id.substring(0, 8)}</strong> - Total: <strong className="text-white">R$ {orderToEvaluate.total_price.toFixed(2)}</strong>
            </p>

            <form onSubmit={handleSubmitComplete} className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Prazo Real de Entrega (Dias decorridos)
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={evalDeliveryDays}
                  onChange={(e) => setEvalDeliveryDays(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-2xl text-white focus:outline-none text-sm font-mono"
                />
              </div>

              {/* Quality Rating */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Qualidade Física dos Insumos
                </label>
                <div className="flex gap-2.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setEvalQuality(star)}
                      className="p-1 hover:scale-110 active:scale-90 transition-transform"
                    >
                      <Star 
                        className={`w-6 h-6 ${star <= evalQuality ? 'text-amber-400 fill-amber-400' : 'text-white/10'}`} 
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Rating */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Relação Preço / Custo-benefício Comercial
                </label>
                <div className="flex gap-2.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setEvalPrice(star)}
                      className="p-1 hover:scale-110 active:scale-90 transition-transform"
                    >
                      <Star 
                        className={`w-6 h-6 ${star <= evalPrice ? 'text-amber-400 fill-amber-400' : 'text-white/10'}`} 
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3.5 bg-purple-950/10 border border-purple-500/10 rounded-2xl flex items-start gap-2.5 text-[10px] text-purple-400">
                <Check className="w-4 h-4 shrink-0 mt-0.5 text-purple-400" />
                <span>
                  <strong>Aviso:</strong> A confirmação registrará uma entrada automatizada para cada insumo no estoque e atualizará o custo médio ponderado deles com base nesta nota.
                </span>
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEvaluateModal(false)}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 text-white font-semibold rounded-2xl text-xs transition-all"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-2xl text-xs shadow-lg shadow-purple-900/10 transition-all flex items-center justify-center gap-1.5"
                >
                  {submitLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Alimentando estoque...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Concluir Recebimento</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedOrderForDetail && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)' }}>
          <div className="p-8 rounded-2xl w-full max-w-xl shadow-2xl relative"
            style={{ background: 'rgba(10,14,26,0.95)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              onClick={() => setSelectedOrderForDetail(null)}
              className="absolute top-6 right-6 p-2 bg-white/5 border border-white/5 hover:bg-white/10 rounded-full text-muted-foreground hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-1.5">
              <Clipboard className="w-6 h-6 text-purple-400" />
              <span>Detalhamento da Nota</span>
            </h3>
            <p className="text-xs text-muted-foreground mb-6">
              Código Pedido: <span className="font-mono text-white font-bold">#{selectedOrderForDetail.id}</span>
            </p>

            <div className="space-y-5 text-xs text-muted-foreground">
              <div className="grid grid-cols-2 gap-4 p-4 bg-black/40 border border-white/5 rounded-2xl text-white">
                <div>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase">Fornecedor Parceiro</p>
                  <p className="font-bold text-sm mt-1">{selectedOrderForDetail.supplier?.name || 'Fornecedor'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase">Consolidado Total</p>
                  <p className="font-bold text-sm mt-1 font-mono text-purple-400">R$ {selectedOrderForDetail.total_price.toFixed(2)}</p>
                </div>
                <div className="col-span-2 pt-2 border-t border-white/5 flex justify-between items-center">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase">Status do Lançamento:</span>
                  <span className={`inline-flex px-2 py-0.5 border rounded-full text-[9px] font-semibold ${getStatusBadge(selectedOrderForDetail.status).color}`}>
                    {getStatusBadge(selectedOrderForDetail.status).label}
                  </span>
                </div>
              </div>

              {/* Evaluate ratings review if completed */}
              {selectedOrderForDetail.status === 'COMPLETED' && (
                <div className="p-4 bg-purple-950/5 border border-purple-500/10 rounded-2xl space-y-2 text-white">
                  <p className="text-[10px] text-purple-400 font-bold uppercase flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-purple-400" />
                    <span>Feedback de Recebimento</span>
                  </p>
                  <div className="flex justify-between text-[11px] pt-1">
                    <span className="text-muted-foreground">Dias de Entrega:</span>
                    <span className="font-mono">{selectedOrderForDetail.delivery_days} dias corridos</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Qualidade Insumo:</span>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star 
                          key={star} 
                          className={`w-3.5 h-3.5 ${(selectedOrderForDetail.quality_rating || 0) >= star ? 'text-amber-400 fill-amber-400' : 'text-white/10'}`} 
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Custo Comercial:</span>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star 
                          key={star} 
                          className={`w-3.5 h-3.5 ${(selectedOrderForDetail.price_rating || 0) >= star ? 'text-amber-400 fill-amber-400' : 'text-white/10'}`} 
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Items List */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Insumos Registrados ({selectedOrderForDetail.items.length} itens)
                </p>
                <div className="border border-white/5 rounded-2xl overflow-hidden max-h-44 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/[0.02] text-muted-foreground uppercase text-[9px]">
                        <th className="px-4 py-2">Insumo</th>
                        <th className="px-4 py-2">Qtd.</th>
                        <th className="px-4 py-2">Custo Unitário</th>
                        <th className="px-4 py-2 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {selectedOrderForDetail.items.map((item) => (
                        <tr key={item.id} className="hover:bg-white/[0.01]">
                          <td className="px-4 py-3 font-semibold text-white">
                            {item.insumo?.name || 'Insumo Excluído'}
                          </td>
                          <td className="px-4 py-3 font-mono text-white">
                            {item.quantity} {item.insumo?.unit}
                          </td>
                          <td className="px-4 py-3 font-mono text-muted-foreground">
                            R$ {item.unit_cost.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-white text-right">
                            R$ {(item.quantity * item.unit_cost).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            <div className="mt-8 pt-4 border-t border-white/5 text-right">
              <button
                onClick={() => setSelectedOrderForDetail(null)}
                className="px-6 py-2 bg-white/5 hover:bg-white/10 text-xs font-semibold text-white rounded-xl transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
