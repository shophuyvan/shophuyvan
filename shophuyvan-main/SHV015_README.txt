SHV015 – Ingest qua server & dùng Cloudinary secure_url (dễ migrate VPS)

1) Copy thư mục này vào repo Pages của https://shophuyvan1.pages.dev
   - Functions:   shophuyvan-main/functions/cld/upload-url.ts
   - Mini helper: shophuyvan-main/apps/mini/src/lib/ensureCloudinary.ts

2) Trên Cloudflare Pages:
   Settings → Environment variables → (Build & Functions)
   - CLOUDINARY_CLOUD = <cloud_name>
   - 1 trong 2 lựa chọn:
     a) CLOUDINARY_UPLOAD_PRESET = shophuyvan  (unsigned)
     b) CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET (signed)

3) Deploy lại. Test:
   curl -X POST https://shophuyvan1.pages.dev/cld/upload-url \
     -H "content-type: application/json" \
     -d '{"src":"<URL gốc ảnh/video>","resource_type":"auto"}'

4) FE Mini (ví dụ PDP):
   import { ensureCloudinaryUrl } from '../lib/ensureCloudinary';
   const [videoUrl, setVideoUrl] = useState(m.src);
   useEffect(() => { ensureCloudinaryUrl(m.src, 'video').then(setVideoUrl); }, [m.src]);
   <video src={videoUrl} ... />

Ghi chú: Khi chuyển sang VPS, chỉ cần dựng 1 service Express với cùng route /cld/upload-url và payload, FE không phải đổi.