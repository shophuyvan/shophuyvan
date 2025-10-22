// File: workers/shv-api/src/cart-sync-handler.js
// Handler cho Cart Sync API

/**
 * Main handler cho /api/cart/sync routes
 */
export async function handleCartSync(request, env) {
  const url = new URL(request.url);
  const method = request.method;
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  
  // Handle OPTIONS (preflight)
  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
    // ==== START FIX: validate KV binding ====
  if (!env || !env.CART_KV) {
    return Response.json(
      { ok: false, error: 'CART_KV not bound in environment' },
      { status: 500, headers: corsHeaders }
    );
  }
  // ==== END FIX: validate KV binding ====

  try {
    let response;
    
    if (method === 'GET') {
      response = await getCart(request, env);
    } else if (method === 'POST') {
      response = await syncCart(request, env);
    } else if (method === 'DELETE') {
      response = await clearCart(request, env);
    } else {
      response = Response.json(
        { ok: false, error: 'Method not allowed' },
        { status: 405 }
      );
    }
    
    // Add CORS headers to response
    const headers = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  } catch (e) {
    console.error('[CartSync] Handler error:', e);
    return Response.json(
      { ok: false, error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * GET /api/cart/sync?session_id=xxx
 * Lấy giỏ hàng từ KV
 */
async function getCart(request, env) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id');
  
  if (!sessionId) {
    return Response.json(
      { ok: false, error: 'Missing session_id parameter' },
      { status: 400 }
    );
  }
  
  try {
    const key = `cart:${sessionId}`;
    const data = await env.CART_KV.get(key);
    
    if (!data) {
      console.log(`[CartSync] No cart found for session: ${sessionId}`);
      return Response.json({
        ok: true,
        cart: [],
        updated_at: null,
        message: 'No cart found'
      });
    }
    
    const parsed = JSON.parse(data);
    console.log(`[CartSync] Retrieved cart for ${sessionId}: ${parsed.items?.length || 0} items`);
    
    return Response.json({
      ok: true,
      cart: parsed.items || [],
      updated_at: parsed.updated_at,
      source: parsed.source
    });
  } catch (e) {
    console.error('[CartSync] Get error:', e);
    return Response.json(
      { ok: false, error: e.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cart/sync
 * Body: { session_id, cart: [...], source: 'fe'|'mini' }
 * Lưu giỏ hàng vào KV
 */
async function syncCart(request, env) {
  try {
    const body = await request.json();
    const { session_id, cart, source } = body;
    
    // Validate
    if (!session_id) {
      return Response.json(
        { ok: false, error: 'Missing session_id' },
        { status: 400 }
      );
    }
    
    if (!Array.isArray(cart)) {
      return Response.json(
        { ok: false, error: 'Cart must be an array' },
        { status: 400 }
      );
    }
    
    const key = `cart:${session_id}`;
    const now = new Date().toISOString();
    
    const data = {
      items: cart,
      updated_at: now,
      source: source || 'unknown',
      session_id: session_id
    };
    
    // Lưu vào KV với TTL 30 ngày
    await env.CART_KV.put(key, JSON.stringify(data), {
      expirationTtl: 30 * 24 * 60 * 60 // 30 days
    });
    
    console.log(`[CartSync] Saved cart for ${session_id}: ${cart.length} items from ${source}`);
    
    return Response.json({
      ok: true,
      updated_at: now,
      items_count: cart.length,
      message: 'Cart synced successfully'
    });
  } catch (e) {
    console.error('[CartSync] Sync error:', e);
    return Response.json(
      { ok: false, error: e.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/cart/sync?session_id=xxx
 * Xóa giỏ hàng
 */
async function clearCart(request, env) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id');
  
  if (!sessionId) {
    return Response.json(
      { ok: false, error: 'Missing session_id parameter' },
      { status: 400 }
    );
  }
  
  try {
    const key = `cart:${sessionId}`;
    await env.CART_KV.delete(key);
    
    console.log(`[CartSync] Cleared cart for session: ${sessionId}`);
    
    return Response.json({
      ok: true,
      message: 'Cart cleared successfully'
    });
  } catch (e) {
    console.error('[CartSync] Clear error:', e);
    return Response.json(
      { ok: false, error: e.message },
      { status: 500 }
    );
  }
}