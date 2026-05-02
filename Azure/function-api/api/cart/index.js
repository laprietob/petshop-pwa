const { CosmosClient } = require("@azure/cosmos");
const crypto = require("crypto");

const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = client.database(process.env.COSMOS_DATABASE);

function verifyToken(token) {
  try {
    const [header, body, signature] = token.split(".");
    const secret = process.env.JWT_SECRET;
    const expectedSig = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
    if (signature !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

module.exports = async function (context, req) {
  context.res = {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  };

  if (req.method === "OPTIONS") {
    context.res.status = 200;
    context.res.body = "";
    return;
  }

  // Verificar autenticación
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    context.res.status = 401;
    context.res.body = JSON.stringify({ error: "Token requerido" });
    return;
  }

  const token = authHeader.split(" ")[1];
  const user = verifyToken(token);
  if (!user) {
    context.res.status = 401;
    context.res.body = JSON.stringify({ error: "Token inválido o expirado" });
    return;
  }

  try {
    const container = database.container("orders");
    const { action } = req.query;

    // GET cart
    if (req.method === "GET" || action === "get") {
      const query = {
        query: "SELECT * FROM c WHERE c.userId = @userId AND c.status = 'cart'",
        parameters: [{ name: "@userId", value: user.userId }]
      };
      const { resources } = await container.items.query(query).fetchAll();
      const cart = resources[0] || { items: [], total: 0 };
      context.res.status = 200;
      context.res.body = JSON.stringify(cart);
      return;
    }

    const body = req.body || {};

    // SAVE / UPDATE cart
    if (action === "save" || req.method === "POST") {
      const { items } = body;

      const total = (items || []).reduce((sum, item) => sum + (item.price * item.quantity), 0);

      // Buscar carrito existente
      const query = {
        query: "SELECT * FROM c WHERE c.userId = @userId AND c.status = 'cart'",
        parameters: [{ name: "@userId", value: user.userId }]
      };
      const { resources } = await container.items.query(query).fetchAll();

      let cartDoc;
      if (resources.length > 0) {
        // Actualizar existente
        cartDoc = { ...resources[0], items, total, updatedAt: new Date().toISOString() };
        await container.items.upsert(cartDoc);
      } else {
        // Crear nuevo
        cartDoc = {
          id: `cart_${user.userId}_${Date.now()}`,
          userId: user.userId,
          userEmail: user.email,
          items: items || [],
          total,
          status: "cart",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await container.items.create(cartDoc);
      }

      context.res.status = 200;
      context.res.body = JSON.stringify({ success: true, cart: cartDoc });
      return;
    }

    // CHECKOUT — convertir carrito en orden
    if (action === "checkout") {
      const query = {
        query: "SELECT * FROM c WHERE c.userId = @userId AND c.status = 'cart'",
        parameters: [{ name: "@userId", value: user.userId }]
      };
      const { resources } = await container.items.query(query).fetchAll();

      if (resources.length === 0 || resources[0].items.length === 0) {
        context.res.status = 400;
        context.res.body = JSON.stringify({ error: "El carrito está vacío" });
        return;
      }

      const order = {
        ...resources[0],
        status: "pending",
        orderNumber: `PET-${Date.now()}`,
        checkoutAt: new Date().toISOString(),
        shippingAddress: body.address || "Por definir"
      };

      await container.items.upsert(order);

      context.res.status = 200;
      context.res.body = JSON.stringify({
        success: true,
        orderNumber: order.orderNumber,
        total: order.total,
        message: "¡Pedido realizado con éxito! 🐾"
      });
      return;
    }

    context.res.status = 400;
    context.res.body = JSON.stringify({ error: "Acción no reconocida" });

  } catch (err) {
    context.log.error("Error en /api/cart:", err);
    context.res.status = 500;
    context.res.body = JSON.stringify({ error: "Error interno del servidor" });
  }
};
