import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  /**
   * Đường dẫn tương đối, KHÔNG phải '/' hay '/pntt/'.
   *
   * GitHub Pages của repo phục vụ tại `https://<user>.github.io/pntt/`, nên base
   * '/' sẽ làm mọi asset trỏ về `https://<user>.github.io/assets/...` và 404 hết.
   * Đóng cứng '/pntt/' thì chạy được Pages nhưng hỏng `vite preview`, hỏng khi mở
   * dist từ ổ đĩa, và hỏng luôn nếu repo đổi tên. './' đúng ở cả bốn trường hợp.
   *
   * An toàn ở đây vì game là MỘT trang, không có router lồng đường dẫn — đó là
   * trường hợp duy nhất mà base tương đối gây rắc rối.
   */
  base: './',
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173, strictPort: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 1600 },
})
