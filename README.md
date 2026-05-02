# 🐾 PetShop PWA — Tu tienda de mascotas siempre contigo

Una Progressive Web App completa estilo Laika para venta de productos para mascotas, con carrito de compras, login seguro y soporte offline.

---

## 📁 Estructura del proyecto

```
petshop-pwa/
├── .github/
│   └── workflows/
│       └── azure-static-web-apps.yml   # CI/CD automático a Azure
├── Azure/
│   ├── cosmos-setup.md                 # Guía paso a paso Azure Cosmos DB
│   └── function-api/
│       ├── host.json
│       ├── local.settings.json
│       └── api/
│           ├── login/
│           │   └── index.js            # Endpoint de autenticación
│           ├── products/
│           │   └── index.js            # Endpoint de productos
│           └── cart/
│               └── index.js            # Endpoint de carrito
├── public/
│   ├── icons/                          # Íconos PWA (genera con instrucciones abajo)
│   ├── manifest.json                   # Manifiesto PWA
│   └── sw.js                           # Service Worker (offline)
├── index.html                          # App principal
├── app.js                              # Lógica JavaScript
├── styles.css                          # Estilos
├── staticwebapp.config.json            # Rutas y auth Azure SWA
└── README.md
```

---

## 🚀 Tecnologías

| Capa | Tecnología |
|------|-----------|
| Frontend | HTML5 + CSS3 + JS Vanilla (PWA) |
| Offline | Service Worker + Cache API |
| Backend | Azure Functions (Node.js) |
| Base de datos | Azure Cosmos DB (NoSQL) |
| Hosting | Azure Static Web Apps |
| CI/CD | GitHub Actions |

---

## ⚙️ Requisitos previos

- Cuenta en [Azure](https://portal.azure.com) (tier gratuito funciona)
- Cuenta en [GitHub](https://github.com)
- [Node.js](https://nodejs.org) v18+ instalado
- [Azure Functions Core Tools](https://learn.microsoft.com/azure/azure-functions/functions-run-local) v4
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli)

---

## 📲 Instalación como PWA en el celular (sin internet)

### En Android (Chrome):
1. Abre la URL de tu app desplegada en Chrome
2. Espera a que cargue completamente
3. Toca el menú (⋮) → **"Añadir a pantalla de inicio"**
4. Confirma → la app aparece como ícono en tu home
5. **Ahora puedes usarla sin internet** ✅

### En iPhone (Safari):
1. Abre la URL en Safari (obligatorio, no Chrome)
2. Toca el botón compartir (□↑)
3. Selecciona **"Añadir a pantalla de inicio"**
4. Confirma el nombre → ícono en home
5. **Funciona offline** ✅

> ⚠️ **Importante**: Debes abrir la app al menos UNA VEZ con internet para que el Service Worker guarde el caché. Después funciona sin conexión.

---

## 🔐 Usuario de prueba

| Campo | Valor |
|-------|-------|
| Usuario | `admin@petshop.com` |
| Contraseña | `PetShop2024!` |

> Cambia estas credenciales en Azure Cosmos DB antes de producción.

---

## 🌐 Despliegue en Azure — Paso a paso

Ver guía detallada en [`Azure/cosmos-setup.md`](Azure/cosmos-setup.md)

**Resumen rápido:**
1. Crear Resource Group en Azure
2. Crear Cosmos DB (Core SQL)
3. Crear Azure Static Web App vinculada a tu repo GitHub
4. Agregar secrets en GitHub
5. Push → GitHub Actions despliega automáticamente

---

## 🛠️ Desarrollo local

```bash
# 1. Clonar repo
git clone https://github.com/TU_USUARIO/petshop-pwa.git
cd petshop-pwa

# 2. Instalar Azure Functions tools
npm install -g azure-functions-core-tools@4

# 3. Configurar variables locales
cp Azure/function-api/local.settings.json.example Azure/function-api/local.settings.json
# Editar con tus conexiones locales

# 4. Iniciar API local
cd Azure/function-api
func start

# 5. Abrir index.html en navegador (usa Live Server de VS Code)
```

---

## ⚠️ Recomendaciones para no fallar

1. **HTTPS obligatorio**: PWA y Service Workers solo funcionan en HTTPS o localhost. Azure SWA da HTTPS gratis ✅
2. **El manifest.json debe estar en la raíz** del sitio web publicado
3. **Los íconos son obligatorios**: mínimo 192x192 y 512x512 PNG
4. **CORS**: Configura los orígenes permitidos en Azure Functions
5. **Secrets nunca en código**: Usa Application Settings en Azure
6. **Prueba offline DESPUÉS del primer deploy**: El SW necesita instalarse primero
7. **Cache version**: Cuando actualices la app, cambia `CACHE_VERSION` en `sw.js`

---

## 📞 Soporte

Ante dudas sobre Azure, revisa la [documentación oficial de Azure Static Web Apps](https://learn.microsoft.com/azure/static-web-apps/).
