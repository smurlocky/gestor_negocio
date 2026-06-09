import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  Plus, Search, Edit3, Trash2, Loader2, AlertCircle, 
  Sparkles, DollarSign, Percent, TrendingUp, TrendingDown, 
  Info, X, ChevronRight, CheckCircle2
} from 'lucide-react';

interface InsumoItem {
  id: string;
  name: string;
  unit: string;
  unit_cost: number;
  current_stock: number;
}

interface CategoryItem {
  id: string;
  name: string;
  type: string;
}

interface ProductIngredient {
  id?: string;
  insumo_id: string;
  quantity: number;
  insumo?: InsumoItem;
}

interface ProductItem {
  id: string;
  name: string;
  price: number;
  category_id: string | null;
  is_active: boolean;
  ingredients: ProductIngredient[];
  created_at: string;
}

export const ProductsRecipes: React.FC = () => {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [insumos, setInsumos] = useState<InsumoItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Modal / Drawer Form States
  const [showFormModal, setShowFormModal] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('0');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  
  // Recipe constructor items state
  const [recipeItems, setRecipeItems] = useState<{ insumo_id: string; quantity: number }[]>([]);

  // Local helper for quick ingredient add
  const [selectedInsumoToAdd, setSelectedInsumoToAdd] = useState('');
  const [qtyToAdd, setQtyToAdd] = useState('');

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/products/');
      setProducts(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao carregar catálogo de produtos.');
    } finally {
      setLoading(false);
    }
  };

  const fetchInsumos = async () => {
    try {
      const res = await api.get('/insumos/');
      setInsumos(res.data);
    } catch (err) {
      console.error('Falha ao carregar insumos', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories/?cat_type=PRODUCT');
      setCategories(res.data);
    } catch (err) {
      console.error('Falha ao carregar categorias', err);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchInsumos();
    fetchCategories();
  }, []);

  const triggerSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 4000);
  };

  // Recipe calculation helpers
  const getIngredientDetails = (insumoId: string) => {
    return insumos.find(i => i.id === insumoId);
  };

  const calculateProductionCost = (items: { insumo_id: string; quantity: number }[]) => {
    return items.reduce((acc, item) => {
      const insumo = getIngredientDetails(item.insumo_id);
      if (!insumo) return acc;
      return acc + (insumo.unit_cost * item.quantity);
    }, 0);
  };

  const calculateProductProductionCost = (product: ProductItem) => {
    return product.ingredients.reduce((acc, ing) => {
      const cost = ing.insumo?.unit_cost ?? 0;
      return acc + (cost * ing.quantity);
    }, 0);
  };

  const currentProductionCost = calculateProductionCost(recipeItems);
  const currentPrice = parseFloat(formPrice) || 0;
  const currentProfit = currentPrice - currentProductionCost;
  const currentMarginPercent = currentPrice > 0 ? (currentProfit / currentPrice) * 100 : 0;

  // Recipe item operations
  const handleAddIngredient = () => {
    if (!selectedInsumoToAdd) return;
    const qty = parseFloat(qtyToAdd);
    if (isNaN(qty) || qty <= 0) {
      alert('Por favor, informe uma quantidade válida maior que zero.');
      return;
    }

    // If already exists, accumulate
    const existsIndex = recipeItems.findIndex(item => item.insumo_id === selectedInsumoToAdd);
    if (existsIndex > -1) {
      const updated = [...recipeItems];
      updated[existsIndex].quantity += qty;
      setRecipeItems(updated);
    } else {
      setRecipeItems([...recipeItems, { insumo_id: selectedInsumoToAdd, quantity: qty }]);
    }

    setSelectedInsumoToAdd('');
    setQtyToAdd('');
  };

  const handleRemoveIngredient = (index: number) => {
    const updated = [...recipeItems];
    updated.splice(index, 1);
    setRecipeItems(updated);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const payload = {
        name: formName,
        price: parseFloat(formPrice) || 0,
        category_id: formCategoryId || null,
        is_active: formIsActive,
        ingredients: recipeItems.map(item => ({
          insumo_id: item.insumo_id,
          quantity: item.quantity
        }))
      };

      if (formMode === 'create') {
        await api.post('/products/', payload);
        triggerSuccess('Produto criado com ficha técnica cadastrada com sucesso!');
      } else {
        await api.put(`/products/${editingId}`, payload);
        triggerSuccess('Produto e ficha técnica atualizados com sucesso!');
      }

      setShowFormModal(false);
      fetchProducts();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao salvar produto.');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm('Tem certeza de que deseja remover este produto do catálogo?')) return;
    setError(null);
    try {
      await api.delete(`/products/${id}`);
      triggerSuccess('Produto removido com sucesso!');
      fetchProducts();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao remover produto.');
    }
  };

  const handleOpenCreateModal = () => {
    setFormMode('create');
    setEditingId(null);
    setFormName('');
    setFormPrice('0');
    setFormCategoryId('');
    setFormIsActive(true);
    setRecipeItems([]);
    setSelectedInsumoToAdd('');
    setQtyToAdd('');
    setShowFormModal(true);
  };

  const handleOpenEditModal = (p: ProductItem) => {
    setFormMode('edit');
    setEditingId(p.id);
    setFormName(p.name);
    setFormPrice(p.price.toString());
    setFormCategoryId(p.category_id || '');
    setFormIsActive(p.is_active);
    
    // Map existing backend ingredients to form ingredients
    setRecipeItems(p.ingredients.map(ing => ({
      insumo_id: ing.insumo_id,
      quantity: ing.quantity
    })));

    setSelectedInsumoToAdd('');
    setQtyToAdd('');
    setShowFormModal(true);
  };

  // Filter products list
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === '' || p.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

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
        <div className="flex items-center gap-3 flex-1 max-w-lg">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar produtos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-2xl text-white placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-xs transition-all"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2.5 bg-white/5 border border-white/5 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-xs transition-all appearance-none cursor-pointer min-w-[150px]"
          >
            <option value="" className="bg-slate-900 text-muted-foreground">Filtrar Categoria</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id} className="bg-slate-900 text-white">{c.name}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-2xl shadow-lg shadow-purple-900/10 flex items-center gap-2 text-xs transition-all hover:scale-[1.01]"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Produto</span>
        </button>
      </div>

      {/* Products Catalog Cards Grid */}
      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-500 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
          <span className="text-sm">Carregando catálogo de receitas...</span>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="p-12 text-center text-slate-500 text-sm rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
          Nenhum produto cadastrado que atenda aos filtros.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((p) => {
            const cost = calculateProductProductionCost(p);
            const profit = p.price - cost;
            const margin = p.price > 0 ? (profit / p.price) * 100 : 0;
            const categoryName = categories.find(c => c.id === p.category_id)?.name || 'Sem Categoria';

            return (
              <div key={p.id} className="p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between group transition-all duration-300"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.25)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
              >
                {/* Visual glass sheen effect on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-500/[0.02] to-indigo-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />

                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 bg-white/5 border border-white/5 text-purple-400 rounded-md">
                        {categoryName}
                      </span>
                      <h4 className="text-lg font-bold text-white mt-1.5 leading-tight group-hover:text-purple-400 transition-colors">
                        {p.name}
                      </h4>
                      <span className="text-[10px] text-muted-foreground font-mono">ID: {p.id.substring(0, 8)}</span>
                    </div>

                    <span className={`inline-flex px-2 py-0.5 border rounded-full text-[9px] font-semibold ${
                      p.is_active 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                      {p.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>

                  {/* Profitability indicators */}
                  <div className="grid grid-cols-2 gap-4 py-4 border-y border-white/5 mb-6 text-xs">
                    <div>
                      <p className="text-muted-foreground">Preço de Venda</p>
                      <p className="text-base font-extrabold text-white mt-1">R$ {p.price.toFixed(2)}</p>
                    </div>

                    <div>
                      <p className="text-muted-foreground">Custo de Produção</p>
                      <p className="text-base font-extrabold text-white mt-1 font-mono">
                        R$ {cost.toFixed(2)}
                      </p>
                    </div>

                    <div className="col-span-2 pt-2 flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        Margem Grossa
                      </span>
                      <span className={`inline-flex items-center gap-1 font-extrabold ${
                        margin >= 40 
                          ? 'text-emerald-400' 
                          : margin >= 15 
                            ? 'text-amber-400' 
                            : 'text-red-400'
                      }`}>
                        {margin >= 15 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        {margin.toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  {/* Ficha Técnica Quick Preview */}
                  <div className="space-y-1 mb-6">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Ficha Técnica ({p.ingredients.length} itens)
                    </p>
                    <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                      {p.ingredients.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Sem ingredientes associados.</p>
                      ) : (
                        p.ingredients.map((ing) => (
                          <div key={ing.id} className="flex justify-between items-center text-[11px] text-muted-foreground hover:text-white py-0.5">
                            <span className="truncate max-w-[150px]">{ing.insumo?.name || 'Insumo Excluído'}</span>
                            <span className="font-mono">{ing.quantity} {ing.insumo?.unit}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2.5 pt-4 mt-auto">
                  <button
                    onClick={() => handleOpenEditModal(p)}
                    className="flex-1 py-2 bg-white/5 hover:bg-white/10 active:bg-white/20 border border-white/5 text-white font-semibold rounded-2xl text-xs flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Ficha Técnica</span>
                  </button>

                  <button
                    onClick={() => handleDeleteProduct(p.id)}
                    className="p-2 hover:bg-red-500/10 active:bg-red-500/20 text-muted-foreground hover:text-red-400 border border-transparent hover:border-red-500/10 rounded-2xl transition-all"
                    title="Excluir produto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT PRODUCT FORM MODAL WITH INTEGRATED DRAWER RECIPE CONSTRUCTOR */}
      {showFormModal && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)' }}>
          <div className="p-8 rounded-2xl w-full max-w-5xl shadow-2xl relative my-8"
            style={{ background: 'rgba(10,14,26,0.95)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              onClick={() => setShowFormModal(false)}
              className="absolute top-6 right-6 p-2 bg-white/5 border border-white/5 hover:bg-white/10 rounded-full text-muted-foreground hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-xl font-bold text-white mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>
              {formMode === 'create' ? 'Cadastrar Produto com Ficha Técnica' : 'Editar Produto e Receita'}
            </h3>
            <p className="text-xs text-muted-foreground mb-8">
              Defina os dados comerciais e monte a árvore de custos de produção de forma interativa.
            </p>

            <form onSubmit={handleSaveProduct} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* LEFT COLUMN: GENERAL INFO */}
              <div className="lg:col-span-5 space-y-5">
                <div className="p-5 bg-white/[0.01] border border-white/5 rounded-3xl space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400">Informações Básicas</h4>
                  
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Nome Comercial do Produto
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Pizza Margherita Grande"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-2xl text-white placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-sm transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Preço de Venda (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="0.00"
                        value={formPrice}
                        onChange={(e) => setFormPrice(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-sm transition-all font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Categoria
                      </label>
                      <select
                        value={formCategoryId}
                        onChange={(e) => setFormCategoryId(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-sm transition-all appearance-none"
                      >
                        <option value="" className="bg-slate-900 text-muted-foreground">Selecionar...</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id} className="bg-slate-900 text-white">{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <input
                      type="checkbox"
                      id="formIsActiveCheck"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      className="w-4 h-4 bg-white/5 border-white/5 rounded focus:ring-purple-500/20 accent-purple-600 cursor-pointer"
                    />
                    <label htmlFor="formIsActiveCheck" className="text-sm font-semibold text-white cursor-pointer select-none">
                      Produto disponível para vendas
                    </label>
                  </div>
                </div>

                {/* FINANCIAL DESK ANALYTICS */}
                <div className="p-6 bg-purple-950/5 border border-purple-500/10 rounded-3xl space-y-4 relative overflow-hidden">
                  <div className="absolute -top-12 -right-12 w-32 h-32 bg-purple-500/5 rounded-full blur-xl" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400">Análise de Rentabilidade</h4>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Preço de Venda:</span>
                      <span className="text-white font-semibold">R$ {currentPrice.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Custo dos Insumos:</span>
                      <span className="text-white font-semibold font-mono">R$ {currentProductionCost.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between items-center text-xs border-t border-white/5 pt-2">
                      <span className="text-muted-foreground">Lucro Bruto Estimado:</span>
                      <span className={`font-semibold ${currentProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        R$ {currentProfit.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-sm font-bold border-t border-white/5 pt-2">
                      <span className="text-white">Margem de Contribuição:</span>
                      <span className={`px-2.5 py-0.5 border rounded-full text-xs font-extrabold ${
                        currentMarginPercent >= 40 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : currentMarginPercent >= 15 
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        {currentMarginPercent.toFixed(0)}%
                      </span>
                    </div>

                    {currentMarginPercent < 15 && currentPrice > 0 && (
                      <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-2xl flex items-start gap-2.5 text-[10px] text-red-400 mt-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                        <span>
                          <strong>Alerta de Margem Crítica!</strong> O custo total dos insumos consome a maior parte ou todo o valor de venda. Recomendamos aumentar o preço de venda ou reduzir a porção dos insumos.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: RECEIPE BUILDER / FICHA TÉCNICA */}
              <div className="lg:col-span-7 space-y-5">
                <div className="p-5 bg-white/[0.01] border border-white/5 rounded-3xl space-y-5">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400">
                      Montador de Ficha Técnica
                    </h4>
                    <span className="text-[10px] font-semibold text-muted-foreground bg-white/5 border border-white/5 px-2 py-0.5 rounded-md">
                      {recipeItems.length} insumos selecionados
                    </span>
                  </div>

                  {/* Add Ingredient Bar */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 bg-white/[0.01] border border-white/5 rounded-2xl items-end">
                    <div className="md:col-span-6">
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Buscar Insumo no Estoque
                      </label>
                      <select
                        value={selectedInsumoToAdd}
                        onChange={(e) => setSelectedInsumoToAdd(e.target.value)}
                        className="w-full px-3 py-2 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-xl text-white focus:outline-none text-xs appearance-none"
                      >
                        <option value="" className="bg-slate-900 text-muted-foreground">Selecione...</option>
                        {insumos.map((i) => (
                          <option key={i.id} value={i.id} className="bg-slate-900 text-white">
                            {i.name} (R$ {i.unit_cost.toFixed(2)} / {i.unit})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-4 grid grid-cols-2 gap-2">
                      <div className="col-span-2">
                        <label className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                          Qtd. ({selectedInsumoToAdd ? getIngredientDetails(selectedInsumoToAdd)?.unit : ''})
                        </label>
                        <input
                          type="number"
                          step="0.0001"
                          placeholder="0.00"
                          value={qtyToAdd}
                          onChange={(e) => setQtyToAdd(e.target.value)}
                          className="w-full px-3 py-2 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-xl text-white focus:outline-none text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <button
                        type="button"
                        onClick={handleAddIngredient}
                        className="w-full py-2 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white font-semibold rounded-xl text-xs transition-all flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>

                  {/* Ingredient list table */}
                  <div className="border border-white/5 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                    {recipeItems.length === 0 ? (
                      <div className="p-8 text-center text-xs text-muted-foreground italic">
                        Insira os insumos acima para constituir o custo da receita deste produto.
                      </div>
                    ) : (
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-white/5 bg-white/[0.02] text-muted-foreground uppercase tracking-wider text-[9px]">
                            <th className="px-4 py-2.5">Insumo</th>
                            <th className="px-4 py-2.5">Qtd. Necessária</th>
                            <th className="px-4 py-2.5">Preço Custo</th>
                            <th className="px-4 py-2.5">Subtotal</th>
                            <th className="px-4 py-2.5 text-right">Ação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {recipeItems.map((item, index) => {
                            const insumo = getIngredientDetails(item.insumo_id);
                            const cost = insumo ? insumo.unit_cost * item.quantity : 0;

                            return (
                              <tr key={item.insumo_id} className="hover:bg-white/[0.01]">
                                <td className="px-4 py-3 font-semibold text-white">
                                  {insumo?.name || 'Insumo Excluído'}
                                </td>
                                <td className="px-4 py-3 font-mono text-white">
                                  {item.quantity.toFixed(3)} {insumo?.unit}
                                </td>
                                <td className="px-4 py-3 font-mono text-muted-foreground">
                                  R$ {insumo?.unit_cost.toFixed(2)}
                                </td>
                                <td className="px-4 py-3 font-mono font-semibold text-white">
                                  R$ {cost.toFixed(2)}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveIngredient(index)}
                                    className="p-1.5 hover:bg-red-500/10 active:bg-red-500/20 text-muted-foreground hover:text-red-400 rounded-xl transition-all"
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
                    onClick={() => setShowFormModal(false)}
                    className="px-6 py-2.5 bg-white/5 hover:bg-white/10 active:bg-white/20 border border-white/5 text-white font-semibold rounded-2xl text-xs transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-2xl text-xs shadow-lg shadow-purple-900/10 transition-all hover:scale-[1.01]"
                  >
                    Salvar Produto e Ficha Técnica
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
