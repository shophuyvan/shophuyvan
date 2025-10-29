// functions/facebook-feed.csv.js
export async function onRequest(context) {
  // TODO: đổi sang API sản phẩm thật (trả JSON array các sản phẩm)
  const PRODUCTS_API = "https://shophuyvan1.pages.dev/api/products.json";

  const escapeCsv = (val = "") => {
    const s = String(val ?? "");
    const needsQuote = /[",\n]/.test(s);
    const out = s.replace(/"/g, '""');
    return needsQuote ? `"${out}"` : out;
  };
  const priceVND = (n) => `${Math.round(Number(n || 0))} VND`;

  let products = [];
  try {
    const res = await fetch(PRODUCTS_API, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error("Fetch fail " + res.status);
    products = await res.json();
  } catch (e) {
    // fallback demo để Facebook luôn đọc được CSV hợp lệ
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

  const header = [
    "id","title","description","availability","condition",
    "price","link","image_link","brand","item_group_id","sale_price"
  ].join(",");

  const rows = products.map(p => {
    const availability = p.inStock ? "in stock" : "out of stock";
    const condition = p.condition || "new";
    const brand = p.brand || "HuyVan";
    const group = p.groupId || p.id;
    const sale = p.salePrice ? priceVND(p.salePrice) : "";
    const fields = [
      p.id, p.title, p.description || "", availability, condition,
      priceVND(p.price), p.url, p.image, brand, group, sale
    ];
    return fields.map(escapeCsv).join(",");
  });

  const csv = header + "\n" + rows.join("\n") + "\n";

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*"
    }
  });
}
