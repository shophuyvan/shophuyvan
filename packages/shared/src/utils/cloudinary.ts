// ================================================
// CLOUDINARY UTILITIES
// packages/shared/src/utils/cloudinary.ts
// ================================================

/**
 * Cloudinary Configuration
 * Matches admin config in product_edit.html
 */
const CLOUD_NAME = 'dtemskptf';
const UPLOAD_PRESET = 'shophuyvan';

/**
 * URL Cache để tránh tính toán lại
 */
const urlCache = new Map<string, string>();

/**
 * Optimize Cloudinary URL với transformations
 * 
 * @example
 * optimizeCloudinaryUrl('https://res.cloudinary.com/.../image.jpg', { width: 400 })
 * // Returns: 'https://res.cloudinary.com/.../w_400,q_auto,f_auto,c_limit/image.jpg'
 */
export function optimizeCloudinaryUrl(
  url: string,
  options: {
    width?: number;
    quality?: string;
    format?: string;
    crop?: string;
  } = {}
): string {
  if (!url || !url.includes('cloudinary.com')) {
    return url;
  }
  
  const {
    width = 800,
    quality = 'auto',
    format = 'auto',
    crop = 'limit'
  } = options;
  
  const transformation = `w_${width},q_${quality},f_${format},c_${crop}`;
  
  // Already has transformation
  if (/\/upload\/[^/]+\//.test(url)) {
    return url;
  }
  
  return url.replace('/upload/', `/upload/${transformation}/`);
}

/**
 * Cloudinary Fetch Delivery
 * Chuyển đổi bất kỳ URL nào thành Cloudinary CDN URL với optimizations
 * 
 * @example
 * cldFetch('https://example.com/image.jpg')
 * // Returns: 'https://res.cloudinary.com/dtemskptf/image/fetch/w_400,dpr_auto,q_auto:eco,f_auto/example.com/image.jpg'
 */
export function cldFetch(
  url?: string,
  transforms: string = 'w_400,dpr_auto,q_auto:eco,f_auto',
  kind: 'image' | 'video' = 'image'
): string | undefined {
  if (!url) return url;
  
  // Check cache
  const cacheKey = `${url}-${transforms}-${kind}`;
  if (urlCache.has(cacheKey)) {
    return urlCache.get(cacheKey);
  }
  
  try {
    // 1. Nếu là link Cloudinary của shop -> Thêm transformations (resize, nén)
    if (url.includes('cloudinary.com') && url.includes(CLOUD_NAME)) {
      // Đã có transform -> trả về luôn
      if (/\/upload\/[^/]+\//.test(url)) {
        urlCache.set(cacheKey, url);
        return url;
      }
      
      // Chưa có -> thêm transform vào sau /upload/
      const newUrl = url.replace('/upload/', `/upload/${transforms}/`);
      urlCache.set(cacheKey, newUrl);
      return newUrl;
    }

    // 2. [CORE SYNC] Nếu là link ngoại lai (Shopee/Lazada/Staging...)
    // TRẢ VỀ LINK GỐC, KHÔNG DÙNG FETCH (tránh lỗi 401)
    urlCache.set(cacheKey, url);
    return url;

  } catch (error) {
    return url;
  }
}

/**
 * Backward compatible alias for cldFetch
 * 
 * @example
 * cloudify('https://example.com/image.jpg', 'w_200,q_auto')
 */
export function cloudify(
  url?: string,
  transforms: string = 'w_400,dpr_auto,q_auto:eco,f_auto'
): string | undefined {
  return cldFetch(url, transforms, 'image');
}

/**
 * Upload file to Cloudinary
 * Matches admin implementation in product_edit.html
 * 
 * @example
 * const file = document.querySelector('input[type="file"]').files[0];
 * const url = await uploadToCloudinary(file, { folder: 'products' });
 */
export async function uploadToCloudinary(
  file: File,
  options: {
    folder?: string;
    resourceType?: 'image' | 'video' | null;
  } = {}
): Promise<string> {
  const { folder = 'products', resourceType = null } = options;
  
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('folder', folder);
    
    const type = resourceType || (file.type.startsWith('video/') ? 'video' : 'image');
    const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${type}/upload`;
    
    console.log(`📤 Uploading ${type}:`, file.name);
    
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || 'Upload failed');
    }
    
    console.log('✅ Upload success:', data.secure_url);
    return data.secure_url;
    
  } catch (error) {
    console.error('❌ Cloudinary upload error:', error);
    throw error;
  }
}

/**
 * Upload multiple files with progress callback
 * 
 * @example
 * const files = Array.from(document.querySelector('input').files);
 * const urls = await uploadMultipleToCloudinary(files, (completed, total) => {
 *   console.log(`Progress: ${completed}/${total}`);
 * });
 */
export async function uploadMultipleToCloudinary(
  files: File[],
  onProgress?: (completed: number, total: number) => void
): Promise<string[]> {
  const total = files.length;
  let completed = 0;
  const results: string[] = [];
  
  const CHUNK_SIZE = 3; // Upload 3 files at a time
  
  for (let i = 0; i < files.length; i += CHUNK_SIZE) {
    const chunk = files.slice(i, i + CHUNK_SIZE);
    
    const uploads = chunk.map(async (file) => {
      try {
        const url = await uploadToCloudinary(file);
        completed++;
        if (onProgress) onProgress(completed, total);
        return url;
      } catch (e) {
        console.error('[Cloudinary] Failed to upload:', file.name, e);
        completed++;
        if (onProgress) onProgress(completed, total);
        return null;
      }
    });
    
    const chunkResults = await Promise.all(uploads);
    results.push(...chunkResults.filter((url): url is string => url !== null));
  }
  
  return results;
}

/**
 * Preload image for better performance
 * 
 * @example
 * await preloadImage('https://res.cloudinary.com/.../image.jpg');
 */
export function preloadImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }
    
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Clear URL cache (useful for development)
 * 
 * @example
 * clearCloudinaryCache();
 */
export function clearCloudinaryCache(): void {
  urlCache.clear();
  console.log('🗑️ Cloudinary cache cleared');
}

/**
 * Get Cloudinary configuration (for debugging)
 * 
 * @example
 * const config = getCloudinaryConfig();
 * console.log('Cloud Name:', config.cloudName);
 */
export function getCloudinaryConfig() {
  return {
    cloudName: CLOUD_NAME,
    uploadPreset: UPLOAD_PRESET
  };
}

// Initialize logging (only in development)
if (typeof window !== 'undefined' && import.meta.env?.DEV) {
  console.log('☁️ Cloudinary initialized:', getCloudinaryConfig());
}