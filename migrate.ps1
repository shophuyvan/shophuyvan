# ===================================================================
# SHV API Migration - PowerShell Script
# ===================================================================

Write-Host "🚀 Starting SHV API Migration..." -ForegroundColor Cyan

# Check if in correct directory
if (-Not (Test-Path "wrangler.toml")) {
    Write-Host "❌ Error: wrangler.toml not found!" -ForegroundColor Red
    Write-Host "Please run this script from project root." -ForegroundColor Yellow
    exit 1
}

# Create backup
$backupDir = "backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Write-Host "📦 Creating backup at $backupDir..." -ForegroundColor Yellow
Copy-Item -Recurse src $backupDir

# Create folders
Write-Host "📁 Creating folder structure..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path src\lib | Out-Null
New-Item -ItemType Directory -Force -Path src\modules | Out-Null
New-Item -ItemType Directory -Force -Path src\tests | Out-Null

# Create lib/response.js
Write-Host "✏️  Creating lib/response.js..." -ForegroundColor Yellow
@'
export function corsHeaders(req) {
  const origin = req.headers.get('Origin') || '*';
  const reqHdr = req.headers.get('Access-Control-Request-Headers') || 
                 'authorization,content-type,x-token,x-requested-with';
  
  return {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Headers': reqHdr,
    'Access-Control-Expose-Headers': 'x-token',
    'Access-Control-Allow-Credentials': 'true'
  };
}

export function json(data, init = {}, req) {
  return new Response(JSON.stringify(data || {}), {
    status: init.status || 200,
    headers: {
      ...corsHeaders(req),
      'content-type': 'application/json; charset=utf-8'
    }
  });
}

export function errorResponse(error, status = 500, req) {
  return json({ 
    ok: false, 
    error: String(error?.message || error) 
  }, { status }, req);
}
'@ | Out-File -Encoding UTF8 src\lib\response.js

# Create lib/kv.js
Write-Host "✏️  Creating lib/kv.js..." -ForegroundColor Yellow
@'
export async function getJSON(env, key, defaultValue = null) {
  try {
    const value = await env.SHV.get(key);
    return value ? JSON.parse(value) : defaultValue;
  } catch (e) {
    console.error('KV getJSON error:', key, e);
    return defaultValue;
  }
}

export async function putJSON(env, key, data) {
  try {
    await env.SHV.put(key, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error('KV putJSON error:', key, e);
    throw e;
  }
}

export async function deleteKey(env, key) {
  try {
    await env.SHV.delete(key);
    return true;
  } catch (e) {
    console.error('KV delete error:', key, e);
    return false;
  }
}
'@ | Out-File -Encoding UTF8 src\lib\kv.js

# Create lib/utils.js
Write-Host "✏️  Creating lib/utils.js..." -ForegroundColor Yellow
@'
export async function readBody(req) {
  try {
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      return await req.json();
    }
    
    const text = await req.text();
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  } catch (e) {
    console.error('readBody error:', e);
    return {};
  }
}

export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function sanitizePhone(phone) {
  return String(phone || '').replace(/\D+/g, '');
}
'@ | Out-File -Encoding UTF8 src\lib\utils.js

# Create lib/auth.js
Write-Host "✏️  Creating lib/auth.js..." -ForegroundColor Yellow
@'
export async function sha256Hex(text) {
  const data = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(String(text || ''))
  );
  return [...new Uint8Array(data)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function adminOK(req, env) {
  const url = new URL(req.url);
  const token = req.headers.get('x-token') || url.searchParams.get('token') || '';
  
  if (!token) return false;
  
  if (env?.SHV?.get) {
    const saved = await env.SHV.get('admin_token');
    if (saved && token === saved) return true;
  }
  
  if (env?.ADMIN_TOKEN) {
    const expected = await sha256Hex(env.ADMIN_TOKEN);
    return token === expected;
  }
  
  return false;
}
'@ | Out-File -Encoding UTF8 src\lib\auth.js

# Create modules/categories.js
Write-Host "✏️  Creating modules/categories.js..." -ForegroundColor Yellow
@'
import { json } from '../lib/response.js';
import { adminOK } from '../lib/auth.js';
import { getJSON, putJSON } from '../lib/kv.js';
import { readBody, slugify } from '../lib/utils.js';

export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  if (path === '/admin/categories' && method === 'GET') {
    return listCategories(req, env);
  }

  if (path === '/admin/categories/upsert' && method === 'POST') {
    return upsertCategory(req, env);
  }

  if (path === '/admin/categories/delete' && method === 'POST') {
    return deleteCategory(req, env);
  }

  if (path === '/public/categories' && method === 'GET') {
    return publicCategories(req, env);
  }

  return json({ ok: false, error: 'Not found' }, { status: 404 }, req);
}

async function listCategories(req, env) {
  const list = await getJSON(env, 'cats:list', []);
  return json({ ok: true, items: list }, {}, req);
}

async function upsertCategory(req, env) {
  if (!(await adminOK(req, env))) {
    return json({ ok: false, error: 'Unauthorized' }, { status: 401 }, req);
  }

  const body = await readBody(req) || {};
  const category = {
    id: body.id || crypto.randomUUID(),
    name: body.name || '',
    slug: body.slug || slugify(body.name || ''),
    parent: body.parent || '',
    order: Number(body.order || 0)
  };

  if (!category.name) {
    return json({ ok: false, error: 'Name is required' }, { status: 400 }, req);
  }

  const list = await getJSON(env, 'cats:list', []);
  const index = list.findIndex(x => x.id === category.id);

  if (index >= 0) {
    list[index] = category;
  } else {
    list.push(category);
  }

  await putJSON(env, 'cats:list', list);
  return json({ ok: true, item: category }, {}, req);
}

async function deleteCategory(req, env) {
  if (!(await adminOK(req, env))) {
    return json({ ok: false, error: 'Unauthorized' }, { status: 401 }, req);
  }

  const body = await readBody(req) || {};
  const id = body.id;

  if (!id) {
    return json({ ok: false, error: 'ID is required' }, { status: 400 }, req);
  }

  const list = await getJSON(env, 'cats:list', []);
  const newList = list.filter(x => x.id !== id);

  await putJSON(env, 'cats:list', newList);
  return json({ ok: true, deleted: id }, {}, req);
}

async function publicCategories(req, env) {
  const list = await getJSON(env, 'cats:list', []);
  const sorted = list.sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  return json({ ok: true, items: sorted }, {}, req);
}
'@ | Out-File -Encoding UTF8 src\modules\categories.js

Write-Host ""
Write-Host "✅ Migration setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "  1. Update src\index.js with imports" -ForegroundColor White
Write-Host "  2. Run: wrangler dev" -ForegroundColor White
Write-Host "  3. Test endpoints" -ForegroundColor White
Write-Host ""
Write-Host "💾 Backup location: $backupDir" -ForegroundColor Yellow