/* ============================================================
   PetShop PWA — app.js (VERSIÓN LIMPIA FINAL)
   ============================================================ */

// ─── CONFIGURACIÓN ──────────────────────────────────────────
const CONFIG = {
  API_BASE: '', // Azure SWA usa rutas relativas
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
  isOnline: navigator.onLine,
  installPromptEvent: null
};

// ─── UTILIDADES ─────────────────────────────────────────────
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => c.querySelectorAll(s);

function formatCOP(amount) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(amount);
}

function showToast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  $('#toastContainer')?.appendChild(el);

  setTimeout(() => {
    el.remove();
  }, 3000);
}

// ─── API CALL ───────────────────────────────────────────────
async function apiCall(endpoint, options = {}) {
  try {
    const res = await fetch(`/api/${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(state.token ? { Authorization: `Bearer ${state.token}` } : {})
      },
      ...options
    });

    let data = {};
    try {
      data = await res.json();
    } catch {}

    if (!res.ok) throw new Error(data.error || 'Error API');

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
  if (!('serviceWorker' in navigator)) return;

  try {
    await navigator.serviceWorker.register('/sw.js');
    console.log('SW registrado');
  } catch (err) {
    console.error('SW error', err);
  }
}

// ─── SESIÓN ────────────────────────────────────────────────
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

  localStorage.removeItem(CONFIG.TOKEN_KEY);
  localStorage.removeItem(CONFIG.USER_KEY);
}

// ─── LOGIN ────────────────────────────────────────────────
async function handleLogin(email, password) {
  try {
    const data = await apiCall('login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    saveSession(data.token, data.user);
    showApp();
    showToast(`Bienvenido ${data.user.name}`, 'success');

  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── UI APP ────────────────────────────────────────────────
function showApp() {
  $('#loginScreen')?.classList.add('hidden');
  $('#appScreen')?.classList.remove('hidden');

  $('#navUserName').textContent =
    state.user?.name || 'Usuario';

  loadProducts();
}

function showLogin() {
  $('#loginScreen')?.classList.remove('hidden');
  $('#appScreen')?.classList.add('hidden');
}

// ─── PRODUCTOS ─────────────────────────────────────────────
async function loadProducts() {
  try {
    const data = await apiCall('products');
    state.products = data.products || [];
    state.filteredProducts = [...state.products];
    renderProducts();
  } catch (err) {
    showToast('Error cargando productos', 'error');
  }
}

function renderProducts() {
  const grid = $('#productsGrid');
  if (!grid) return;

  grid.innerHTML = state.filteredProducts.map(p => `
    <div class="product-card">
      <div>${p.emoji || '🐾'}</div>
      <h3>${p.name}</h3>
      <p>${formatCOP(p.price)}</p>
      <button onclick="app.addToCart('${p.id}')">Agregar</button>
    </div>
  `).join('');
}

// ─── CARRITO ──────────────────────────────────────────────
function addToCart(id) {
  const product = state.products.find(p => p.id === id);
  if (!product) return;

  const item = state.cart.find(i => i.id === id);

  if (item) item.quantity++;
  else state.cart.push({ ...product, quantity: 1 });

  localStorage.setItem(CONFIG.CART_KEY, JSON.stringify(state.cart));
  showToast('Agregado al carrito', 'success');
}

// ─── NAVEGACIÓN ────────────────────────────────────────────
function showView(view) {
  document.querySelectorAll('.view')
    .forEach(v => v.classList.add('hidden'));

  $(`#view-${view}`)?.classList.remove('hidden');
}

// ─── EVENTOS ──────────────────────────────────────────────
function initEvents() {
  $('#loginForm')?.addEventListener('submit', e => {
    e.preventDefault();
    handleLogin(
      $('#email').value,
      $('#password').value
    );
  });
}

// ─── INIT ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  registerServiceWorker();
  initEvents();

  if (loadSession()) showApp();
  else showLogin();
});

// ─── API EXPUESTA ────────────────────────────────────────
window.app = {
  addToCart,
  showView
};