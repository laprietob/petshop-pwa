const { CosmosClient } = require("@azure/cosmos");

const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = client.database(process.env.COSMOS_DATABASE);

module.exports = async function (context, req) {
  context.res = {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  };

  if (req.method === "OPTIONS") {
    context.res.status = 200;
    context.res.body = "";
    return;
  }

  try {
    const container = database.container("products");
    const { category, id } = req.query;

    // Obtener producto por ID
    if (id) {
      const { resource } = await container.item(id, undefined).read();
      if (!resource) {
        context.res.status = 404;
        context.res.body = JSON.stringify({ error: "Producto no encontrado" });
        return;
      }
      context.res.status = 200;
      context.res.body = JSON.stringify(resource);
      return;
    }

    // Obtener todos o filtrar por categoría
    let query;
    if (category && category !== "todos") {
      query = {
        query: "SELECT * FROM c WHERE c.category = @category ORDER BY c.name",
        parameters: [{ name: "@category", value: category }]
      };
    } else {
      query = { query: "SELECT * FROM c ORDER BY c.category, c.name" };
    }

    const { resources } = await container.items.query(query).fetchAll();

    context.res.status = 200;
    context.res.body = JSON.stringify({
      products: resources,
      total: resources.length
    });

  } catch (err) {
    context.log.error("Error en /api/products:", err);

    // Fallback con productos mock si Cosmos no está disponible
    const mockProducts = [
      { id: "p1", name: "Croquetas Premium Perro Adulto", category: "perros", price: 45000, originalPrice: 52000, emoji: "🐕", description: "Alimento balanceado para perros adultos con proteína de pollo", stock: 50, brand: "Royal Canin", featured: true },
      { id: "p2", name: "Arena Sanitaria para Gatos", category: "gatos", price: 28000, originalPrice: 32000, emoji: "🐈", description: "Arena aglomerante sin polvo, control de olores 30 días", stock: 80, brand: "Catsan", featured: true },
      { id: "p3", name: "Correa Retráctil 5m", category: "accesorios", price: 35000, originalPrice: null, emoji: "🦮", description: "Correa retráctil resistente con mango ergonómico", stock: 30, brand: "Flexi", featured: false },
      { id: "p4", name: "Antiparasitario Perros", category: "salud", price: 22000, originalPrice: 25000, emoji: "💊", description: "Pipeta antiparasitaria para perros de 10-25 kg", stock: 100, brand: "Frontline", featured: true },
      { id: "p5", name: "Cama Ortopédica Mascotas", category: "accesorios", price: 89000, originalPrice: 110000, emoji: "🛏️", description: "Cama memory foam para mascotas con cubierta lavable", stock: 15, brand: "PetComfort", featured: true },
      { id: "p6", name: "Snacks Dentales Perro", category: "perros", price: 18000, originalPrice: null, emoji: "🦴", description: "Premios masticables para higiene dental diaria", stock: 200, brand: "DentaFlex", featured: false },
      { id: "p7", name: "Rascador para Gato", category: "gatos", price: 55000, originalPrice: 65000, emoji: "🐱", description: "Rascador vertical con plataforma y juguetes colgantes", stock: 20, brand: "CatTree", featured: false },
      { id: "p8", name: "Vitaminas Articulaciones", category: "salud", price: 42000, originalPrice: null, emoji: "💉", description: "Suplemento con glucosamina y condroitina para mascotas senior", stock: 45, brand: "VetPlus", featured: false }
    ];

    context.res.status = 200;
    context.res.body = JSON.stringify({
      products: mockProducts,
      total: mockProducts.length,
      source: "fallback"
    });
  }
};
