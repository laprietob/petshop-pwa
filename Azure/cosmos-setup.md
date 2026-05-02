# 🗄️ Guía completa: Azure Cosmos DB + Static Web Apps

## PASO 1 — Crear el Resource Group

1. Ve a [portal.azure.com](https://portal.azure.com)
2. Busca **"Resource groups"** en la barra superior
3. Clic en **"+ Create"**
4. Completa:
   - **Subscription**: Tu suscripción (Free Trial o Pay-as-you-go)
   - **Resource group name**: `rg-petshop-pwa`
   - **Region**: `East US` (o la más cercana a Colombia)
5. Clic **"Review + create"** → **"Create"**

---

## PASO 2 — Crear Azure Cosmos DB

1. Busca **"Azure Cosmos DB"** en el portal
2. Clic **"+ Create"**
3. Selecciona **"Azure Cosmos DB for NoSQL"** (Core SQL)
4. Completa:
   - **Resource Group**: `rg-petshop-pwa`
   - **Account Name**: `petshop-db` (debe ser único global)
   - **Location**: `East US`
   - **Capacity mode**: `Serverless` ← **MUY IMPORTANTE** (gratis para bajo tráfico)
5. Clic **"Review + create"** → **"Create"**
6. ⏳ Espera 5-10 minutos

### Crear la base de datos y colecciones:
1. Entra a tu cuenta Cosmos DB
2. Clic en **"Data Explorer"** (menú izquierdo)
3. Clic **"New Container"**:

**Base de datos:**
- Database id: `petshop`
- Container id: `users`
- Partition key: `/email`

4. Crea otro container:
- Database id: `petshop` (mismo)
- Container id: `products`
- Partition key: `/category`

5. Crea otro container:
- Database id: `petshop` (mismo)
- Container id: `orders`
- Partition key: `/userId`

### Obtener la cadena de conexión:
1. Menú izquierdo → **"Keys"**
2. Copia **"PRIMARY CONNECTION STRING"**
3. Guárdala en un lugar seguro (la necesitas en el Paso 4)

### Cargar datos iniciales (usuarios y productos):
En Data Explorer → Container `users` → **"New Item"** → pega:
```json
{
  "id": "user001",
  "email": "admin@petshop.com",
  "password": "$2b$10$HASH_GENERADO",
  "name": "Administrador",
  "role": "admin"
}
```
> ⚠️ En producción NUNCA guardes contraseñas en texto plano. La API hace el hash automáticamente en el endpoint /api/login al registrar usuarios.

Para cargar los productos de ejemplo, en container `products` → **"New Item"** por cada producto del archivo `products-seed.json` (incluido abajo).

---

## PASO 3 — Crear Azure Static Web App

1. Busca **"Static Web Apps"** en el portal
2. Clic **"+ Create"**
3. Completa:
   - **Resource Group**: `rg-petshop-pwa`
   - **Name**: `petshop-pwa-app`
   - **Plan type**: `Free`
   - **Region**: `East US 2`
   - **Source**: `GitHub`
4. Clic **"Sign in with GitHub"** → autoriza acceso
5. Selecciona:
   - **Organization**: Tu usuario u organización
   - **Repository**: `petshop-pwa`
   - **Branch**: `main`
6. En **Build Details**:
   - **Build Presets**: `Custom`
   - **App location**: `/`
   - **Api location**: `Azure/function-api`
   - **Output location**: `` (vacío)
7. Clic **"Review + create"** → **"Create"**

> ✅ Azure crea automáticamente el archivo `.github/workflows/azure-static-web-apps.yml` en tu repo via commit

---

## PASO 4 — Configurar variables de entorno (secrets)

### En Azure Portal:
1. Ve a tu Static Web App → **"Configuration"** (menú izquierdo)
2. Clic **"+ Add"** para cada variable:

| Name | Value |
|------|-------|
| `COSMOS_CONNECTION_STRING` | (La cadena del Paso 2) |
| `COSMOS_DATABASE` | `petshop` |
| `JWT_SECRET` | (genera uno: cadena aleatoria de 32+ chars) |

3. Clic **"Save"**

### En GitHub (para CI/CD):
1. Ve a tu repo → **Settings** → **Secrets and variables** → **Actions**
2. El token de deployment ya fue agregado por Azure automáticamente como `AZURE_STATIC_WEB_APPS_API_TOKEN`
3. Si no está, cópialo desde Azure SWA → **Manage deployment token**

---

## PASO 5 — Hacer el primer deploy

```bash
# En tu máquina local
git add .
git commit -m "feat: initial petshop pwa setup"
git push origin main
```

1. Ve a GitHub → **Actions** → verás el workflow corriendo
2. Espera ~3 minutos
3. Ve a Azure SWA → copia la **URL** (algo como `https://xyz.azurestaticapps.net`)
4. ¡Abre esa URL en tu celular! 🎉

---

## PASO 6 — Cargar productos en Cosmos DB

En Azure Portal → Cosmos DB → Data Explorer → Container `products` → New Item:

```json
{
  "id": "prod001",
  "name": "Croquetas Premium Perro Adulto",
  "category": "perros",
  "price": 45000,
  "originalPrice": 52000,
  "image": "🐕",
  "description": "Alimento balanceado para perros adultos con proteína de pollo",
  "stock": 50,
  "brand": "Royal Canin"
}
```

Repite con los demás productos (ver archivo `products-seed.json` en este folder).

---

## ✅ Verificación final

- [ ] La URL de la app abre sin errores
- [ ] Puedes hacer login con `admin@petshop.com`
- [ ] Los productos se cargan desde Cosmos DB
- [ ] Puedes agregar al carrito
- [ ] Activas la app en el celular con internet
- [ ] Desconectas el wifi y la app sigue funcionando
- [ ] El ícono aparece en la pantalla de inicio

---

## ⚠️ Errores comunes y soluciones

| Error | Causa | Solución |
|-------|-------|----------|
| `401 Unauthorized` | JWT_SECRET no configurado | Revisar Configuration en Azure SWA |
| `503 Service Unavailable` | API no desplegada | Revisar Api location en el workflow |
| `CORS error` | Origen no permitido | Agregar URL en `staticwebapp.config.json` |
| App no instala | Falta HTTPS | Azure SWA siempre da HTTPS ✅ |
| SW no cachea | Manifest mal configurado | Verificar `start_url` y rutas |
| Cosmos timeout | Region lejana | Cambiar a `East US` |
