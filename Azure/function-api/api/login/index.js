const { CosmosClient } = require("@azure/cosmos");
const crypto = require("crypto");

const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = client.database(process.env.COSMOS_DATABASE);

// Utilidad simple de JWT sin librerías externas
function generateToken(payload) {
  const secret = process.env.JWT_SECRET;
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 86400 })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

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

function hashPassword(password) {
  return crypto.createHash("sha256").update(password + process.env.JWT_SECRET).digest("hex");
}

module.exports = async function (context, req) {
  context.res = {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  };

  // Preflight
  if (req.method === "OPTIONS") {
    context.res.status = 200;
    context.res.body = "";
    return;
  }

  try {
    const { action, email, password } = req.body || {};

    if (!action) {
      context.res.status = 400;
      context.res.body = JSON.stringify({ error: "Acción requerida" });
      return;
    }

    const container = database.container("users");

    // LOGIN
    if (action === "login") {
      if (!email || !password) {
        context.res.status = 400;
        context.res.body = JSON.stringify({ error: "Email y contraseña requeridos" });
        return;
      }

      const query = {
        query: "SELECT * FROM c WHERE c.email = @email",
        parameters: [{ name: "@email", value: email.toLowerCase().trim() }]
      };

      const { resources } = await container.items.query(query).fetchAll();

      if (resources.length === 0) {
        context.res.status = 401;
        context.res.body = JSON.stringify({ error: "Credenciales inválidas" });
        return;
      }

      const user = resources[0];
      const hashedInput = hashPassword(password);

      if (user.password !== hashedInput) {
        context.res.status = 401;
        context.res.body = JSON.stringify({ error: "Credenciales inválidas" });
        return;
      }

      const token = generateToken({ userId: user.id, email: user.email, name: user.name, role: user.role });

      context.res.status = 200;
      context.res.body = JSON.stringify({
        success: true,
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role }
      });
      return;
    }

    // REGISTER (solo para setup inicial)
    if (action === "register") {
      if (!email || !password) {
        context.res.status = 400;
        context.res.body = JSON.stringify({ error: "Email y contraseña requeridos" });
        return;
      }

      // Verificar si ya existe
      const checkQuery = {
        query: "SELECT c.id FROM c WHERE c.email = @email",
        parameters: [{ name: "@email", value: email.toLowerCase().trim() }]
      };
      const { resources: existing } = await container.items.query(checkQuery).fetchAll();
      if (existing.length > 0) {
        context.res.status = 409;
        context.res.body = JSON.stringify({ error: "El usuario ya existe" });
        return;
      }

      const newUser = {
        id: `user_${Date.now()}`,
        email: email.toLowerCase().trim(),
        password: hashPassword(password),
        name: req.body.name || email.split("@")[0],
        role: "customer",
        createdAt: new Date().toISOString()
      };

      await container.items.create(newUser);
      const token = generateToken({ userId: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role });

      context.res.status = 201;
      context.res.body = JSON.stringify({
        success: true,
        token,
        user: { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role }
      });
      return;
    }

    // VERIFY TOKEN
    if (action === "verify") {
      const authHeader = req.headers["authorization"];
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        context.res.status = 401;
        context.res.body = JSON.stringify({ valid: false });
        return;
      }
      const token = authHeader.split(" ")[1];
      const payload = verifyToken(token);
      if (!payload) {
        context.res.status = 401;
        context.res.body = JSON.stringify({ valid: false });
        return;
      }
      context.res.status = 200;
      context.res.body = JSON.stringify({ valid: true, user: payload });
      return;
    }

    context.res.status = 400;
    context.res.body = JSON.stringify({ error: "Acción no reconocida" });

  } catch (err) {
    context.log.error("Error en /api/login:", err);
    context.res.status = 500;
    context.res.body = JSON.stringify({ error: "Error interno del servidor" });
  }
};
