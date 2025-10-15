export async function readBody(req) {
  try {
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      return await req.json();
    }
    
    const text = await req.text();
    
    // Try parse as JSON
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
    .replace(/[\u0300-\u036f]/g, '')  // Remove Vietnamese diacritics
    .replace(/đ/g, 'd')                // Handle đ separately
    .replace(/[^a-z0-9]+/g, '-')       // Replace non-alphanumeric with dash
    .replace(/(^-|-$)/g, '');          // Remove leading/trailing dashes
}

export function sanitizePhone(phone) {
  // Remove all non-digit characters
  return String(phone || '').replace(/\D+/g, '');
}

export function formatVND(amount) {
  try {
    return Number(amount || 0).toLocaleString('vi-VN') + 'đ';
  } catch {
    return (amount || 0) + 'đ';
  }
}
