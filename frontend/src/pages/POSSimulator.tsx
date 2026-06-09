import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  Search, Plus, Minus, Trash2, ShoppingCart, CheckCircle2,
  AlertCircle, Loader2, Sparkles, Receipt, RefreshCw, X
} from 'lucide-react';

interface InsumoItem {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
}

interface CategoryItem {
  id: string;
  name: string;
  type: string;
}

interface ProductIngredient {
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
}

interface CartItem {
  product: ProductItem;
  quantity: number;
}

interface CompletedSaleItem {
  id: string;
  total_price: number;
  created_at: string;
  items_count: number;
}

export const POSSimulator: React.FC = () => {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  // Session Recent Sales
  const [recentSales, setRecentSales] = useState<CompletedSaleItem[]>([]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const prodRes = await api.get('/products/');
      // Filter only active products
      setProducts(prodRes.data.filter((p: ProductItem) => p.is_active));

      const catRes = await api.get('/categories/?cat_type=PRODUCT');
      setCategories(catRes.data);

      const orderRes = await api.get('/orders/');
      setRecentSales(orderRes.data.slice(0, 5)); // Get last 5 sales
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao carregar dados do simulador PDV.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const triggerSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 5000);
  };

  // Cart operations
  const addToCart = (product: ProductItem) => {
    const exists = cart.find(item => item.product.id === product.id);
    if (exists) {
      setCart(cart.map(item =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.product.id === productId) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const cartTotal = cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
  const cartItemsCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  // Send POS order to backend
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setCheckoutLoading(true);
    setError(null);
    try {
      const payload = {
        items: cart.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity
        }))
      };

      const res = await api.post('/orders/', payload);

      // Success triggers: wipe cart, refresh recent sales & stock indicators
      clearCart();
      triggerSuccess(`Venda registrada! ID: ${res.data.id.substring(0, 8)}. Estoque baixado com sucesso pelo motor automatizado!`);

      // Refresh list of products and recent sales
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao registrar venda. Verifique se há insumos suficientes no estoque.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Filters catalog
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategoryId === '' || p.category_id === selectedCategoryId;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 rounded-xl flex items-start gap-3 text-sm animate-fade-in"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-white">Falha no Registro de Venda</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(252,165,165,0.7)' }}>{error}</p>
          </div>
          <button onClick={() => setError(null)} className="p-1 hover:bg-white/5 rounded-lg"><X size={14} /></button>
        </div>
      )}
      {success && (
        <div className="p-4 rounded-xl flex items-start gap-3 text-sm animate-fade-in"
          style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', color: '#6ee7b7' }}>
          <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-white">Baixa Concluída!</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(110,231,183,0.7)' }}>{success}</p>
          </div>
          <button onClick={() => setSuccess(null)} className="p-1 hover:bg-white/5 rounded-lg"><X size={14} /></button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* LEFT COLUMN: PRODUCTS CATALOG GRID (COL 7) */}
        <div className="lg:col-span-7 space-y-6">

          {/* Filters Bar */}
          <div className="glass-panel p-4 rounded-3xl flex flex-col md:flex-row items-center gap-4 border-white/5">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar produto para registrar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-2xl text-white placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-xs transition-all"
              />
            </div>

            {/* Category tabs */}
            <div className="flex gap-2 overflow-x-auto w-full md:w-auto py-1">
              <button
                onClick={() => setSelectedCategoryId('')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${selectedCategoryId === ''
                  ? 'bg-purple-600/15 border-purple-500/30 text-purple-400'
                  : 'bg-white/5 border-white/5 text-muted-foreground hover:text-white'
                  }`}
              >
                Todos
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategoryId(c.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${selectedCategoryId === c.id
                    ? 'bg-purple-600/15 border-purple-500/30 text-purple-400'
                    : 'bg-white/5 border-white/5 text-muted-foreground hover:text-white'
                    }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Catalog grid */}
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-500 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
              <span className="text-sm">Carregando catálogo de vendas...</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm rounded-2xl"
              style={{ border: '1px dashed rgba(255,255,255,0.08)' }}>
              Nenhum produto ativo encontrado com este filtro.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-1">
              {filteredProducts.map((p) => {
                const ingredientsCount = p.ingredients.length;
                return (
                  <div
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="p-5 rounded-2xl flex flex-col justify-between transition-all duration-200 cursor-pointer active:scale-[0.98] select-none group relative overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
                  >
                    <div className="absolute top-2 right-2 p-1.5 bg-purple-600/10 border border-purple-500/20 text-purple-400 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                      <Plus className="w-4 h-4" />
                    </div>

                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 bg-white/5 border border-white/5 text-purple-400 rounded-md">
                        {categories.find(c => c.id === p.category_id)?.name || 'Produto'}
                      </span>
                      <h4 className="text-base font-bold text-white mt-2 leading-tight">
                        {p.name}
                      </h4>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {ingredientsCount > 0
                          ? `Ficha Técnica: ${ingredientsCount} insumos associados`
                          : 'Baixa direta (Sem ficha técnica)'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-5 pt-3 border-t border-white/5">
                      <span className="text-xs text-muted-foreground">Preço Unitário</span>
                      <span className="text-base font-extrabold text-white">R$ {p.price.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: ACTIVE CHECKOUT BASKET & HISTORY */}
        <div className="lg:col-span-5 space-y-6">
          {/* Active Cart */}
          <div className="p-6 rounded-2xl relative overflow-hidden"
            style={{ background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.12)' }}>
            <div className="absolute top-6 right-6 p-2 rounded-2xl text-indigo-400"
              style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.15)' }}>
              <ShoppingCart className="w-5 h-5" />
            </div>

            <h3 className="text-lg font-bold text-white mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>Caixa Registradora</h3>
            <p className="text-xs text-muted-foreground mb-6">Monte a venda atual e execute a baixa automática.</p>

            {/* Cart items list */}
            <div className="space-y-4 max-h-[300px] overflow-y-auto mb-6 pr-1">
              {cart.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm italic">
                  Selecione os produtos ao lado para incluir na venda do cliente.
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.product.id} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white truncate">{item.product.name}</p>
                      <span className="text-xs text-muted-foreground font-mono">
                        R$ {item.product.price.toFixed(2)} x {item.quantity}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center bg-white/5 border border-white/5 rounded-xl overflow-hidden">
                        <button
                          onClick={() => updateQuantity(item.product.id, -1)}
                          className="px-2 py-1.5 hover:bg-white/5 active:bg-white/10 text-muted-foreground hover:text-white transition-all"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-3 text-xs text-white font-bold font-mono">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product.id, 1)}
                          className="px-2 py-1.5 hover:bg-white/5 active:bg-white/10 text-muted-foreground hover:text-white transition-all"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 active:bg-red-500/20 rounded-xl transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Sum stats */}
            {cart.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-white/5 mb-6 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Itens adicionados:</span>
                  <span className="text-white font-semibold font-mono">{cartItemsCount}</span>
                </div>
                <div className="flex justify-between text-base font-extrabold border-t border-white/5 pt-3">
                  <span className="text-white">Valor Total Geral:</span>
                  <span className="text-white text-lg font-mono">R$ {cartTotal.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/5 text-xs text-white font-semibold rounded-2xl transition-all"
                >
                  Limpar
                </button>
              )}

              <button
                disabled={cart.length === 0 || checkoutLoading}
                onClick={handleCheckout}
                className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-purple-900/20 disabled:to-indigo-900/20 disabled:text-muted-foreground font-bold text-white rounded-2xl shadow-lg shadow-purple-900/10 flex items-center justify-center gap-2 text-xs transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                {checkoutLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processando Baixa...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Confirmar e Registrar Venda</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Session History Log */}
          <div className="p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'rgba(139,92,246,0.9)', fontFamily: 'Outfit, sans-serif' }}>
                <Receipt size={14} />
                <span>Últimas Vendas</span>
              </h4>
              <button onClick={fetchData} className="p-1.5 hover:bg-white/5 rounded-lg text-slate-500 hover:text-white transition-all" title="Recarregar">
                <RefreshCw size={14} />
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {recentSales.length === 0 ? (
                <p className="text-xs text-slate-500 italic text-center py-4">Nenhuma venda registrada nesta empresa.</p>
              ) : (
                recentSales.map((sale) => (
                  <div key={sale.id} className="p-3 rounded-xl flex justify-between items-center text-xs"
                    style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <p className="font-semibold text-white">Cupom #{sale.id.substring(0, 8)}</p>
                      <span className="text-[10px] text-slate-500">
                        {new Date(sale.created_at).toLocaleTimeString('pt-BR')} — {sale.items_count} item(s)
                      </span>
                    </div>
                    <span className="font-bold text-white font-mono">R$ {sale.total_price.toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
