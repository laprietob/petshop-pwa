/* ============================================================
   PetShop PWA — app.js
   Lógica principal: auth, productos, carrito, SW, PWA install
   ============================================================ */

// ─── CONFIGURACIÓN ──────────────────────────────────────────
const CONFIG = {
  // Cuando estés en Azure, deja API_BASE vacío — las rutas relativas funcionan
  // Para desarrollo local con func start: 'http://localhost:7071'
  API_BASE: '',
  TOKEN_KEY: 'petshop_token',
  USER_KEY: 'petshop_user',
  CART_KEY: 'petshop_cart',
  ORDERS_KEY: 'petshop_orders'
};

// ─── ESTADO GLOBAL ──────────────────────────────────────────
let state = {
  user: null,
  token: null,
  products: [],
  filteredProducts: [],
  cart: [],
  orders: [],
  currentView: 'home',
  isOnline: navigator.onLine,
  installPromptEvent: null
};

// ─── UTILIDADES ─────────────────────────────────────────────
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => ctx.querySelectorAll(sel);

function formatCOP(amount) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

function showToast(message, type = 'info', duration = 3000) {
  const container = $('#toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

async function apiCall(endpoint, options = {}) {
  const url = `${CONFIG.API_BASE}/api/${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(state.token ? { 'Authorization': `Bearer ${state.token}` } : {}),
    ...options.headers
  };

  try {
    const response = await fetch(url, { ...options, headers });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Error ${response.status}`);
    }
    return data;
  } catch (err) {
    if (!navigator.onLine) {
      throw new Error('Sin conexión a internet');
    }
    throw err;
  }
}

// ─── SERVICE WORKER ─────────────────────────────────────────
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker no soportado');
    return;
  }

  try {
    const reg = await navigator.serviceWorker.register('/public/sw.js', {
      scope: '/'
    });
    console.log('[App] Service Worker registrado:', reg.scope);

    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          showToast('🔄 Nueva versión disponible — Recarga la página', 'info', 8000);
        }
      });
    });
  } catch (err) {
    console.error('[App] Error registrando SW:', err);
  }
}

// ─── PWA INSTALL PROMPT ──────────────────────────────────────
function initInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.installPromptEvent = event;

    // Mostrar prompt después de 3 segundos si el usuario está en la app
    setTimeout(() => {
      const prompt = $('#installPrompt');
      if (state.user && prompt) {
        prompt.classList.remove('hidden');
      }
    }, 3000);
  });

  $('#installBtn')?.addEventListener('click', async () => {
    if (!state.installPromptEvent) return;
    state.installPromptEvent.prompt();
    const { outcome } = await state.installPromptEvent.userChoice;
    console.log('[App] Install outcome:', outcome);
    state.installPromptEvent = null;
    $('#installPrompt').classList.add('hidden');
  });

  $('#dismissInstall')?.addEventListener('click', () => {
    $('#installPrompt').classList.add('hidden');
  });

  window.addEventListener('appinstalled', () => {
    showToast('🎉 ¡PetShop instalada correctamente!', 'success');
    $('#installPrompt').classList.add('hidden');
  });
}

// ─── CONECTIVIDAD ────────────────────────────────────────────
function initConnectivity() {
  const updateStatus = (online) => {
    state.isOnline = online;
    const indicator = $('#offlineIndicator');
    if (indicator) {
      indicator.classList.toggle('hidden', online);
    }
    if (!online) {
      showToast('📵 Sin conexión — Modo offline activo', 'info');
    } else {
      showToast('✅ Conexión restaurada', 'success', 2000);
      // Recargar productos cuando vuelva la conexión
      if (state.user) loadProducts();
    }
  };

  window.addEventListener('online', () => updateStatus(true));
  window.addEventListener('offline', () => updateStatus(false));
}

// ─── AUTH ────────────────────────────────────────────────────
function loadSession() {
  const token = localStorage.getItem(CONFIG.TOKEN_KEY);
  const user = localStorage.getItem(CONFIG.USER_KEY);
  if (token && user) {
    state.token = token;
    state.user = JSON.parse(user);
    return true;
  }
  return false;
}

function saveSession(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem(CONFIG.TOKEN_KEY, token);
  localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(user));
}

function clearSession() {
  state.token = null;
  state.user = null;
  state.cart = [];
  localStorage.removeItem(CONFIG.TOKEN_KEY);
  localStorage.removeItem(CONFIG.USER_KEY);
  localStorage.removeItem(CONFIG.CART_KEY);
}

async function handleLogin(email, password) {
  const btn = $('#loginBtn');
  const errorDiv = $('#loginError');
  const btnText = btn.querySelector('.btn-text');
  const btnLoader = btn.querySelector('.btn-loader');

  // UI loading
  btn.disabled = true;
  btnText.classList.add('hidden');
  btnLoader.classList.remove('hidden');
  errorDiv.classList.add('hidden');

  try {
    // Si está offline, intentar login con datos guardados
    if (!navigator.onLine) {
      const savedUser = localStorage.getItem(CONFIG.USER_KEY);
      const savedToken = localStorage.getItem(CONFIG.TOKEN_KEY);
      if (savedUser && savedToken) {
        const user = JSON.parse(savedUser);
        if (user.email === email.toLowerCase().trim()) {
          state.token = savedToken;
          state.user = user;
          showApp();
          showToast('🔓 Sesión restaurada (modo offline)', 'info');
          return;
        }
      }
      throw new Error('Sin conexión — No se puede verificar las credenciales');
    }

    const data = await apiCall('login', {
      method: 'POST',
      body: JSON.stringify({ action: 'login', email, password })
    });

    saveSession(data.token, data.user);
    showApp();
    showToast(`¡Bienvenido, ${data.user.name}! 🐾`, 'success');

  } catch (err) {
    errorDiv.textContent = err.message || 'Error al iniciar sesión';
    errorDiv.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btnText.classList.remove('hidden');
    btnLoader.classList.add('hidden');
  }
}

function showApp() {
  $('#loginScreen').classList.remove('active');
  $('#loginScreen').classList.add('hidden');
  $('#appScreen').classList.remove('hidden');
  $('#appScreen').classList.add('active');

  // Actualizar nombre en el nav
  const name = state.user?.name || state.user?.email?.split('@')[0] || 'Usuario';
  $('#navUserName').textContent = `Hola, ${name} 👋`;

  // Cargar datos
  loadProductsFromStorage(); // offline-first
  loadProducts();            // luego desde la red
  loadCartFromStorage();
  updateCartUI();
  showView('home');
}

function showLogin() {
  $('#appScreen').classList.remove('active');
  $('#appScreen').classList.add('hidden');
  $('#loginScreen').classList.remove('hidden');
  $('#loginScreen').classList.add('active');
}

// ─── PRODUCTOS ───────────────────────────────────────────────
function loadProductsFromStorage() {
  const cached = localStorage.getItem('petshop_products');
  if (cached) {
    const { products, timestamp } = JSON.parse(cached);
    const age = Date.now() - timestamp;
    if (age < 3600000) { // 1 hora
      state.products = products;
      state.filteredProducts = [...products];
      renderProducts();
      renderFeatured();
    }
  }
}

async function loadProducts() {
  try {
    const activeCategory = $('.cat-btn.active')?.dataset?.cat || 'todos';
    const endpoint = activeCategory !== 'todos'
      ? `products?category=${activeCategory}`
      : 'products';

    const data = await apiCall(endpoint);
    state.products = data.products || [];
    state.filteredProducts = [...state.products];

    // Guardar en localStorage para offline
    localStorage.setItem('petshop_products', JSON.stringify({
      products: state.products,
      timestamp: Date.now()
    }));

    renderProducts();
    renderFeatured();
  } catch (err) {
    if (!state.products.length) {
      showToast('⚠️ No se pudieron cargar los productos', 'error');
    }
  }
}

function renderProducts() {
  const grid = $('#productsGrid');
  if (!grid) return;

  const products = state.filteredProducts;

  if (products.length === 0) {
    grid.innerHTML = '';
    $('#emptyState')?.classList.remove('hidden');
    return;
  }

  $('#emptyState')?.classList.add('hidden');
  grid.innerHTML = products.map(renderProductCard).join('');
  attachProductCardListeners(grid);
}

function renderFeatured() {
  const grid = $('#featuredGrid');
  if (!grid) return;
  const featured = state.products.filter(p => p.featured).slice(0, 4);
  const products = featured.length > 0 ? featured : state.products.slice(0, 4);
  grid.innerHTML = products.map(renderProductCard).join('');
  attachProductCardListeners(grid);
}

function renderProductCard(product) {
  const discount = product.originalPrice
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : null;

  return `
    <div class="product-card" data-product-id="${product.id}">
      <div class="product-emoji">${product.emoji || '🐾'}</div>
      <div class="product-name">${product.name}</div>
      <div class="product-brand">${product.brand || ''}</div>
      <div class="product-prices">
        <span class="product-price">${formatCOP(product.price)}</span>
        ${product.originalPrice ? `<span class="product-original-price">${formatCOP(product.originalPrice)}</span>` : ''}
        ${discount ? `<span class="product-discount">-${discount}%</span>` : ''}
      </div>
      <button class="btn-add-cart" data-product-id="${product.id}" onclick="event.stopPropagation()">
        + Agregar al carrito
      </button>
    </div>
  `;
}

function attachProductCardListeners(container) {
  // Click en la tarjeta → abrir modal
  container.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-add-cart')) return;
      const id = card.dataset.productId;
      openProductModal(id);
    });
  });

  // Click en "Agregar al carrito"
  container.querySelectorAll('.btn-add-cart').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.productId;
      addToCart(id);
    });
  });
}

function filterByCategory(category) {
  $$('.cat-btn').forEach(b => b.classList.remove('active'));
  $$(`.cat-btn[data-cat="${category}"]`).forEach(b => b.classList.add('active'));

  state.filteredProducts = category === 'todos'
    ? [...state.products]
    : state.products.filter(p => p.category === category);

  applySearch();
  renderProducts();
}

function applySearch() {
  const query = $('#searchInput')?.value?.toLowerCase().trim() || '';
  if (!query) {
    state.filteredProducts = state.products.filter(p => {
      const cat = $('.cat-btn.active')?.dataset?.cat || 'todos';
      return cat === 'todos' || p.category === cat;
    });
  } else {
    state.filteredProducts = state.products.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.brand?.toLowerCase().includes(query) ||
      p.description?.toLowerCase().includes(query)
    );
  }
  renderProducts();
}

// ─── MODAL DE PRODUCTO ───────────────────────────────────────
function openProductModal(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  const discount = product.originalPrice
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : null;

  const modalBody = $('#modalBody');
  modalBody.innerHTML = `
    <div class="modal-product-emoji">${product.emoji || '🐾'}</div>
    <div class="modal-product-name">${product.name}</div>
    <div class="modal-product-brand">${product.brand || ''} ${product.category ? '· ' + product.category : ''}</div>
    <div class="modal-product-desc">${product.description || 'Sin descripción disponible.'}</div>
    <div class="modal-product-price">
      ${formatCOP(product.price)}
      ${discount ? `<small style="font-size:0.6em;color:var(--green);margin-left:8px">-${discount}% OFF</small>` : ''}
    </div>
    <button class="btn-primary full-width" id="modalAddToCart">
      🛒 Agregar al carrito
    </button>
  `;

  $('#modalAddToCart').addEventListener('click', () => {
    addToCart(productId);
    closeProductModal();
  });

  const modal = $('#productModal');
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeProductModal() {
  $('#productModal').classList.add('hidden');
  document.body.style.overflow = '';
}

// ─── CARRITO ─────────────────────────────────────────────────
function loadCartFromStorage() {
  const saved = localStorage.getItem(CONFIG.CART_KEY);
  if (saved) {
    state.cart = JSON.parse(saved);
  }
}

function saveCartToStorage() {
  localStorage.setItem(CONFIG.CART_KEY, JSON.stringify(state.cart));
  // Sincronizar con API (best effort)
  syncCartWithAPI();
}

async function syncCartWithAPI() {
  if (!navigator.onLine || !state.token) return;
  try {
    await apiCall('cart?action=save', {
      method: 'POST',
      body: JSON.stringify({ items: state.cart })
    });
  } catch {
    // Silencioso — el carrito ya está guardado localmente
  }
}

function addToCart(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  const existing = state.cart.find(item => item.id === productId);
  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      emoji: product.emoji || '🐾',
      quantity: 1
    });
  }

  saveCartToStorage();
  updateCartUI();
  showToast(`🛒 ${product.name} agregado al carrito`, 'success', 2000);

  // Animación en el botón del carrito
  const btn = $('#cartBtn');
  btn?.classList.add('cart-bounce');
  setTimeout(() => btn?.classList.remove('cart-bounce'), 500);
}

function removeFromCart(productId) {
  state.cart = state.cart.filter(item => item.id !== productId);
  saveCartToStorage();
  updateCartUI();
  renderCart();
}

function updateCartQuantity(productId, delta) {
  const item = state.cart.find(i => i.id === productId);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) {
    removeFromCart(productId);
    return;
  }
  saveCartToStorage();
  updateCartUI();
  renderCart();
}

function updateCartUI() {
  const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const badge = $('#cartBadge');
  const bottomBadge = $('#bottomCartBadge');

  if (badge) {
    badge.textContent = count;
    badge.classList.toggle('hidden', count === 0);
  }
  if (bottomBadge) {
    bottomBadge.textContent = count;
    bottomBadge.classList.toggle('hidden', count === 0);
  }
}

function renderCart() {
  const listEl = $('#cartItems');
  const emptyEl = $('#cartEmpty');
  const summaryEl = $('#cartSummary');
  if (!listEl) return;

  if (state.cart.length === 0) {
    listEl.innerHTML = '';
    emptyEl?.classList.remove('hidden');
    summaryEl?.classList.add('hidden');
    return;
  }

  emptyEl?.classList.add('hidden');
  summaryEl?.classList.remove('hidden');

  listEl.innerHTML = state.cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-emoji">${item.emoji}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">${formatCOP(item.price * item.quantity)}</div>
      </div>
      <div class="cart-item-controls">
        <button class="qty-btn" onclick="app.updateCartQuantity('${item.id}', -1)">−</button>
        <span class="qty-display">${item.quantity}</span>
        <button class="qty-btn" onclick="app.updateCartQuantity('${item.id}', 1)">+</button>
        <button class="btn-remove-item" onclick="app.removeFromCart('${item.id}')">🗑</button>
      </div>
    </div>
  `).join('');

  const total = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  if ($('#cartSubtotal')) $('#cartSubtotal').textContent = formatCOP(total);
  if ($('#cartTotal')) $('#cartTotal').textContent = formatCOP(total);
}

async function handleCheckout() {
  if (state.cart.length === 0) {
    showToast('⚠️ Tu carrito está vacío', 'error');
    return;
  }

  const btn = $('#checkoutBtn');
  btn.disabled = true;
  btn.textContent = 'Procesando… ⏳';

  try {
    if (navigator.onLine && state.token) {
      const result = await apiCall('cart?action=checkout', {
        method: 'POST',
        body: JSON.stringify({ items: state.cart })
      });

      // Guardar orden localmente
      const orders = JSON.parse(localStorage.getItem(CONFIG.ORDERS_KEY) || '[]');
      orders.unshift({
        orderNumber: result.orderNumber,
        total: result.total,
        items: [...state.cart],
        date: new Date().toISOString(),
        status: 'pending'
      });
      localStorage.setItem(CONFIG.ORDERS_KEY, JSON.stringify(orders));

      showToast(`✅ ${result.message} Pedido: ${result.orderNumber}`, 'success', 5000);
    } else {
      // Modo offline: guardar localmente
      const orderNumber = `PET-OFF-${Date.now()}`;
      const orders = JSON.parse(localStorage.getItem(CONFIG.ORDERS_KEY) || '[]');
      orders.unshift({
        orderNumber,
        total: state.cart.reduce((s, i) => s + i.price * i.quantity, 0),
        items: [...state.cart],
        date: new Date().toISOString(),
        status: 'pending_sync'
      });
      localStorage.setItem(CONFIG.ORDERS_KEY, JSON.stringify(orders));
      showToast(`📵 Pedido guardado localmente (${orderNumber}). Se enviará cuando haya internet.`, 'info', 6000);
    }

    // Limpiar carrito
    state.cart = [];
    saveCartToStorage();
    updateCartUI();
    renderCart();
    showView('orders');
    renderOrders();

  } catch (err) {
    showToast(`❌ Error: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Finalizar pedido 🐾';
  }
}

// ─── PEDIDOS ─────────────────────────────────────────────────
function renderOrders() {
  const list = $('#ordersList');
  if (!list) return;

  const orders = JSON.parse(localStorage.getItem(CONFIG.ORDERS_KEY) || '[]');
  state.orders = orders;

  if (orders.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span>📦</span>
        <p>Aún no tienes pedidos</p>
        <button class="btn-secondary" onclick="app.showView('products')">Empezar a comprar</button>
      </div>
    `;
    return;
  }

  list.innerHTML = orders.map(order => `
    <div class="order-card">
      <div class="order-number">${order.orderNumber}</div>
      <div class="order-status">${order.status === 'pending_sync' ? '⏳ Pendiente sincronización' : '✅ Confirmado'}</div>
      <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">
        ${new Date(order.date).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}
      </div>
      <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">
        ${order.items?.map(i => `${i.emoji} ${i.name} ×${i.quantity}`).join(' · ')}
      </div>
      <div class="order-total">${formatCOP(order.total)}</div>
    </div>
  `).join('');
}

// ─── NAVEGACIÓN ──────────────────────────────────────────────
function showView(viewName) {
  state.currentView = viewName;

  // Ocultar todas las vistas
  $$('.view').forEach(v => v.classList.remove('active'));
  const target = $(`#view${viewName.charAt(0).toUpperCase() + viewName.slice(1)}`);
  target?.classList.add('active');

  // Actualizar nav lateral
  $$('.nav-link').forEach(l => l.classList.remove('active'));
  $(`.nav-link[data-view="${viewName}"]`)?.classList.add('active');

  // Actualizar bottom nav
  $$('.bottom-nav-btn').forEach(b => b.classList.remove('active'));
  $(`.bottom-nav-btn[data-view="${viewName}"]`)?.classList.add('active');

  // Acciones específicas por vista
  if (viewName === 'cart') renderCart();
  if (viewName === 'orders') renderOrders();
  if (viewName === 'products') {
    if (!state.products.length) loadProducts();
    renderProducts();
  }

  closeSideNav();
}

function openSideNav() {
  $('#sideNav')?.classList.remove('hidden');
  $('#navOverlay')?.classList.remove('hidden');
}

function closeSideNav() {
  $('#sideNav')?.classList.add('hidden');
  $('#navOverlay')?.classList.add('hidden');
}

// ─── INICIALIZACIÓN ──────────────────────────────────────────
function initEventListeners() {
  // LOGIN
  $('#loginForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = $('#emailInput').value.trim();
    const password = $('#passwordInput').value;
    if (!email || !password) return;
    handleLogin(email, password);
  });

  $('#togglePassword, .toggle-password')?.addEventListener('click', () => {
    const input = $('#passwordInput');
    if (input) input.type = input.type === 'password' ? 'text' : 'password';
  });

  // NAV
  $('#menuBtn')?.addEventListener('click', openSideNav);
  $('#closeNavBtn')?.addEventListener('click', closeSideNav);
  $('#navOverlay')?.addEventListener('click', closeSideNav);

  $$('.nav-link').forEach(btn => {
    btn.addEventListener('click', () => showView(btn.dataset.view));
  });

  $$('.bottom-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showView(btn.dataset.view));
  });

  // LOGOUT
  $('#logoutBtn')?.addEventListener('click', () => {
    if (confirm('¿Cerrar sesión?')) {
      clearSession();
      showLogin();
    }
  });

  // CART
  $('#cartBtn')?.addEventListener('click', () => showView('cart'));
  $('#checkoutBtn')?.addEventListener('click', handleCheckout);

  // PRODUCTOS — categorías
  $$('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => filterByCategory(btn.dataset.cat));
  });

  // BÚSQUEDA
  let searchTimer;
  $('#searchInput')?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applySearch, 300);
  });

  // MODAL
  $('#modalCloseBtn')?.addEventListener('click', closeProductModal);
  $('#productModal .modal-overlay')?.addEventListener('click', closeProductModal);

  // Tecla Escape cierra modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeProductModal();
  });
}

// ─── PUBLIC API (expuesta para uso en HTML) ──────────────────
window.app = {
  showView,
  addToCart,
  removeFromCart,
  updateCartQuantity,
  openProductModal,
  closeProductModal
};

// ─── ARRANQUE ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Registrar Service Worker
  registerServiceWorker();

  // Inicializar features
  initConnectivity();
  initInstallPrompt();
  initEventListeners();

  // Verificar sesión existente
  if (loadSession()) {
    showApp();
  } else {
    showLogin();
  }

  // Mostrar banner offline si aplica
  if (!navigator.onLine) {
    $('#offlineBanner')?.classList.remove('hidden');
  }
});
