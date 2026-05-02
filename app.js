
/* ============================================================
   PetShop PWA — app.js
   Lógica principal: auth, productos, carrito, SW, PWA install
   ============================================================ */

// ─── CONFIGURACIÓN ──────────────────────────────────────────
const CONFIG = {
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

// FIX JSON AQUÍ
async function apiCall(endpoint, options = {}) {
  const url = `${CONFIG.API_BASE}/api/${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(state.token ? { 'Authorization': `Bearer ${state.token}` } : {}),
    ...options.headers
  };

  try {
    const response = await fetch(url, { ...options, headers });

    let data;
    try {
      data = await response.json();
    } catch {
      data = {};
    }

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
  } catch (err) {
    console.error('[App] Error registrando SW:', err);
  }
}

// ─── AUTH ───────────────────────────────────────────────────
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

function showApp() {
  $('#loginScreen')?.classList.remove('active');
  $('#loginScreen')?.classList.add('hidden');

  $('#appScreen')?.classList.remove('hidden');
  $('#appScreen')?.classList.add('active');
}

function showLogin() {
  $('#appScreen')?.classList.add('hidden');
  $('#loginScreen')?.classList.remove('hidden');
}

// ─── INICIALIZACIÓN ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {

  registerServiceWorker();

  
 // FORZAR SIEMPRE APP (ignorar login)
state.user = {
  name: 'Invitado',
  email: 'guest@petshop.com',
  role: 'guest'
};

state.token = null;

 showApp();

});
