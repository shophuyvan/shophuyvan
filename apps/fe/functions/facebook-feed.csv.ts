// functions/facebook-feed.csv.ts
export const onRequest: PagesFunction = async ({ request, env, next }) => {
  // TODO: đổi sang API nguồn thật của bạn (trả về mảng sản phẩm)
  // Có thể là API của BE, D1, KV... miễn trả JSON array.
  const PRODUCTS_API = "https://shophuyvan1.pages.dev/api/products.json";

  // --- util ---
  const escapeCsv = (val: unknown = "") => {
    const s = String(val ?? "");
    const needsQuote = /[",\n]/.test(s);
    const out = s.replace(/"/g, '""');
    return needsQuote ? `"${out}"` : out;
  };
  const priceVND = (n: unknown) => `${Math.round(Number(n || 0))} VND`;

  type Product = {
    id: string;
    title: string;
    description?: string;
    price: number;
    salePrice?: number | null;
    inStock: boolean;
    condition?: "new" | "used" | "refurbished";
    brand?: string;
    image: string;
    url: string;
    groupId?: string;
  };

  // --- fetch data ---
  let products: Product[] = [];
  try {
    const res = await fetch(PRODUCTS_API, {
      cf: { cacheTtl: 120, cacheEverything: true },
      headers: { "accept": "application/json" }
    });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    products = await res.json();
  } catch (e) {
    // fallback demo để CSV luôn trả được dữ liệu hợp lệ (không chặn Facebook)
    products = [{
      id: "SP-001",
      title: "Áo thun cổ tròn",
      description: "Áo cotton 100% co giãn, form regular.",
      price: 129000,
      salePrice: 99000,
      inStock: true,
      image: "https://shophuyvan1.pages.dev/images/ao-thun-tron.jpg",
      url: "https://shophuyvan1.pages.dev/products/ao-thun-co-tron",
      brand: "HuyVan",
      groupId: "AVT-CO-TRON"
    }];
  }

  // --- build CSV ---
  const header = [
    "id","title","description","availability","condition",
    "price","link","image_link","brand","item_group_id","sale_price"
  ].join(",");

  const rows = products.map(p => {
    const availability = p.inStock ? "in stock" : "out of stock";
    const condition = p.condition ?? "new";
    const brand = p.brand ?? "HuyVan";
    const group = p.groupId ?? p.id;
    const sale = p.salePrice ? priceVND(p.salePrice) : "";

    const fields = [
      p.id,
      p.title,
      p.description ?? "",
      availability,
      condition,
      priceVND(p.price),
      p.url,
      p.image,
      brand,
      group,
      sale
    ];
    return fields.map(escapeCsv).join(",");
  });

  const csv = `${header}\n${rows.join("\n")}\n`;

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*"
    }
  });
};
