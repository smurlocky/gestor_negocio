import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  Plus, Search, ShieldAlert, ArrowUpRight, ArrowDownRight, 
  RotateCw, Edit3, Trash2, Loader2, AlertCircle, Sparkles
} from 'lucide-react';

interface InsumoItem {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  minimum_stock: number;
  unit_cost: number;
  category_id: string | null;
}

interface CategoryItem {
  id: string;
  name: string;
  type: string;
}

export const InsumosStock: React.FC = () => {
  const [insumos, setInsumos] = useState<InsumoItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states for Create/Edit Insumo
  const [showInsumoModal, setShowInsumoModal] = useState(false);
  const [insumoMode, setInsumoMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formUnit, setFormUnit] = useState('g');
  const [formMinStock, setFormMinStock] = useState('0');
  const [formCurrentStock, setFormCurrentStock] = useState('0'); // Create only
  const [formUnitCost, setFormUnitCost] = useState('0'); // Create only
  const [formCategoryId, setFormCategoryId] = useState('');

  // Form states for manual movement
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [selectedInsumo, setSelectedInsumo] = useState<InsumoItem | null>(null);
  const [moveQty, setMoveQty] = useState('');
  const [moveType, setMoveType] = useState('INPUT');
  const [moveCost, setMoveCost] = useState('0'); // for INPUT avg cost
  const [moveReason, setMoveReason] = useState('');

  const fetchInsumos = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/insumos/');
      setInsumos(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao carregar insumos.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories/?cat_type=INSUMO');
      setCategories(res.data);
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  };

  useEffect(() => {
    fetchInsumos();
    fetchCategories();
  }, []);

  const handleSaveInsumo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const payload: any = {
        name: formName,
        unit: formUnit,
        minimum_stock: parseFloat(formMinStock) || 0,
        category_id: formCategoryId || null
      };

      if (insumoMode === 'create') {
        payload.current_stock = parseFloat(formCurrentStock) || 0;
        payload.unit_cost = parseFloat(formUnitCost) || 0;
        await api.post('/insumos/', payload);
      } else {
        await api.put(`/insumos/${editingId}`, payload);
      }
      setShowInsumoModal(false);
      fetchInsumos();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao salvar insumo.');
    }
  };

  const handleDeleteInsumo = async (id: string) => {
    if (!window.confirm('Tem certeza de que deseja excluir este insumo? Isso afetará fichas técnicas.')) return;
    setError(null);
    try {
      await api.delete(`/insumos/${id}`);
      fetchInsumos();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao excluir insumo.');
    }
  };

  const handleOpenMovementModal = (i: InsumoItem) => {
    setSelectedInsumo(i);
    setMoveQty('');
    setMoveType('INPUT');
    setMoveCost(i.unit_cost.toString());
    setMoveReason('');
    setShowMovementModal(true);
  };

  const handleSaveMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInsumo) return;
    setError(null);
    try {
      await api.post(`/insumos/${selectedInsumo.id}/movement?unit_cost_input=${parseFloat(moveCost) || 0}`, {
        quantity: parseFloat(moveQty) || 0,
        type: moveType,
        reason: moveReason || null
      });
      setShowMovementModal(false);
      fetchInsumos();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao registrar movimentação.');
    }
  };

  const getStockStatus = (i: InsumoItem) => {
    if (i.current_stock <= 0) return { label: 'Zerado', color: 'text-red-400 bg-red-500/10 border-red-500/20' };
    if (i.current_stock < i.minimum_stock) return { label: 'Crítico', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20 animate-pulse' };
    return { label: 'Normal', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 rounded-xl flex items-center gap-3 text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
          <AlertCircle size={16} className="text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative max-w-xs flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar insumos..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-white placeholder-slate-600 text-xs transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={fetchInsumos}
            className="btn-refresh"
            title="Atualizar estoque"
          >
            <RotateCw size={13} />
            <span>Atualizar</span>
          </button>
          
          <button
            onClick={() => {
              setInsumoMode('create');
              setFormName('');
              setFormUnit('g');
              setFormMinStock('0');
              setFormCurrentStock('0');
              setFormUnitCost('0');
              setFormCategoryId('');
              setShowInsumoModal(true);
            }}
            className="px-4 py-2.5 text-white font-semibold rounded-xl shadow-lg flex items-center gap-2 text-xs transition-all hover:scale-[1.01]"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 8px 24px rgba(124,58,237,0.2)' }}
          >
            <Plus size={14} />
            <span>Cadastrar Insumo</span>
          </button>
        </div>
      </div>

      {/* Main Stock Table */}
      <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
            <span className="text-sm">Carregando inventário de insumos...</span>
          </div>
        ) : insumos.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            Nenhum insumo cadastrado no estoque.
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <th className="px-6 py-4">Insumo</th>
                <th className="px-6 py-4">Estoque Atual</th>
                <th className="px-6 py-4">Estoque Mínimo</th>
                <th className="px-6 py-4">Custo Unitário</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {insumos.map((i) => {
                const statusInfo = getStockStatus(i);
                return (
                  <tr key={i.id} className="hover:bg-white/[0.01] transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-semibold text-white">{i.name}</p>
                        <span className="text-[10px] text-slate-500">ID: {i.id.substring(0, 8)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-white">
                      {i.current_stock.toFixed(2)} {i.unit}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-slate-400">
                      {i.minimum_stock.toFixed(2)} {i.unit}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-white">
                      R$ {i.unit_cost.toFixed(2)} / {i.unit}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 border rounded-full text-[10px] font-semibold ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenMovementModal(i)}
                          className="px-3 py-1.5 text-violet-400 hover:text-violet-300 text-[10px] font-semibold rounded-xl transition-all flex items-center gap-1"
                          style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}
                        >
                          <Sparkles size={12} />
                          <span>Lançar</span>
                        </button>
                        
                        <button
                          onClick={() => {
                            setInsumoMode('edit');
                            setEditingId(i.id);
                            setFormName(i.name);
                            setFormUnit(i.unit);
                            setFormMinStock(i.minimum_stock.toString());
                            setFormCategoryId(i.category_id || '');
                            setShowInsumoModal(true);
                          }}
                          className="p-2 rounded-xl transition-all text-slate-500 hover:text-white hover:bg-white/5"
                        >
                          <Edit3 size={14} />
                        </button>

                        <button
                          onClick={() => handleDeleteInsumo(i.id)}
                          className="p-2 rounded-xl transition-all text-slate-500 hover:text-red-400 hover:bg-red-500/8"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* CREATE / EDIT INSUMO MODAL */}
      {showInsumoModal && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}>
          <div className="glass-panel p-8 rounded-2xl w-full max-w-md shadow-2xl relative">
            <h3 className="text-lg font-bold text-white mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>
              {insumoMode === 'create' ? 'Cadastrar Insumo' : 'Editar Dados Gerais'}
            </h3>

            <form onSubmit={handleSaveInsumo} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Nome do Insumo
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Queijo Muçarela"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-2xl text-white placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-sm transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Unidade de Medida
                  </label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-sm transition-all appearance-none"
                  >
                    <option value="g" className="bg-slate-900 text-white">g (Gramas)</option>
                    <option value="ml" className="bg-slate-900 text-white">ml (Mililitros)</option>
                    <option value="un" className="bg-slate-900 text-white">un (Unidade)</option>
                    <option value="kg" className="bg-slate-900 text-white">kg (Kilograma)</option>
                    <option value="l" className="bg-slate-900 text-white">l (Litros)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Estoque Mínimo
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formMinStock}
                    onChange={(e) => setFormMinStock(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-sm transition-all font-mono"
                  />
                </div>
              </div>

              {insumoMode === 'create' && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Estoque Inicial
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formCurrentStock}
                      onChange={(e) => setFormCurrentStock(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-sm transition-all font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Preço de Custo (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formUnitCost}
                      onChange={(e) => setFormUnitCost(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-sm transition-all font-mono"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Categoria do Insumo
                </label>
                <select
                  value={formCategoryId}
                  onChange={(e) => setFormCategoryId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-sm transition-all appearance-none"
                >
                  <option value="" className="bg-slate-900 text-muted-foreground">Selecione uma categoria...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id} className="bg-slate-900 text-white">{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowInsumoModal(false)}
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

      {/* STOCK MOVEMENT MODAL */}
      {showMovementModal && selectedInsumo && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}>
          <div className="glass-panel p-8 rounded-2xl w-full max-w-md shadow-2xl relative">
            <h3 className="text-lg font-bold text-white mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>Registrar Movimentação</h3>
            <p className="text-xs text-muted-foreground mb-6">
              Lançamento para o insumo: <span className="text-white font-bold">{selectedInsumo.name}</span>
            </p>

            <form onSubmit={handleSaveMovement} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Tipo de Movimento
                  </label>
                  <select
                    value={moveType}
                    onChange={(e) => setMoveType(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-sm transition-all appearance-none"
                  >
                    <option value="INPUT" className="bg-slate-900 text-white">Entrada (Compra)</option>
                    <option value="OUTPUT" className="bg-slate-900 text-white">Saída (Descarte)</option>
                    <option value="ADJUSTMENT" className="bg-slate-900 text-white">Ajuste manual</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Quantidade ({selectedInsumo.unit})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={moveQty}
                    onChange={(e) => setMoveQty(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-sm transition-all font-mono"
                  />
                </div>
              </div>

              {moveType === 'INPUT' && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Preço de Custo Unitário da Compra (R$ / {selectedInsumo.unit})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={moveCost}
                    onChange={(e) => setMoveCost(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-sm transition-all font-mono"
                  />
                  <span className="text-[10px] text-purple-400 mt-1 block">
                    Calcula automaticamente o custo médio ponderado móvel do insumo.
                  </span>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Motivo / Observação
                </label>
                <input
                  type="text"
                  placeholder="Ex: Nota Fiscal 1234, Descarte por vencimento"
                  value={moveReason}
                  onChange={(e) => setMoveReason(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-2xl text-white placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-sm transition-all"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowMovementModal(false)}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 active:bg-white/20 border border-white/5 text-white font-semibold rounded-2xl text-xs transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-2xl text-xs shadow-lg shadow-purple-900/10 transition-all"
                >
                  Salvar Lançamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
