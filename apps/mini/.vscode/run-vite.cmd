@echo off
REM Wrapper gọi Vite qua npx để tránh lỗi MODULE_NOT_FOUND khi gọi node trực tiếp
npx vite %*