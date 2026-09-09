import { DataTexture, LinearFilter, RGBAFormat, UnsignedByteType, type Texture } from 'three'

/** Cạnh của ảnh, pixel. 64 là đủ: nó chỉ là một vệt mờ tròn, không có chi tiết. */
const SIZE = 64

/**
 * Vệt mờ tròn, SINH BẰNG CODE.
 *
 * Đây là cách duy nhất để có hạt mềm mà không phá tính chất quan trọng nhất của
 * project: không một file asset nào. Một `DataTexture` 64×64 dựng lúc nạp module
 * tốn 16 KB bộ nhớ và không thêm một byte nào vào bundle — trong khi một file
 * PNG khói thì vừa thêm dung lượng, vừa thêm một lượt tải, vừa mở cửa cho cái
 * pipeline asset mà cả project được thiết kế để không cần.
 *
 * Alpha giảm dần từ tâm theo `smoothstep`, RGB để trắng để `instanceColor` nhuộm
 * được. Với `AdditiveBlending` của three thì alpha vẫn điều biến (src·srcAlpha +
 * dst), nên dốc alpha chính là cái làm ra mép mềm.
 */
function buildSoftTexture(): Texture {
  const data = new Uint8Array(SIZE * SIZE * 4)
  const half = (SIZE - 1) / 2

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = (x - half) / half
      const dy = (y - half) / half
      const r = Math.hypot(dx, dy)
      // smoothstep(1, 0.05, r): đặc ở tâm, tắt hẳn trước khi tới mép ảnh nên
      // không để lại đường viền vuông của texture
      const t = Math.max(0, Math.min(1, (1 - r) / 0.95))
      const a = t * t * (3 - 2 * t)
      const i = (y * SIZE + x) * 4
      data[i] = 255
      data[i + 1] = 255
      data[i + 2] = 255
      data[i + 3] = Math.round(a * 255)
    }
  }

  const texture = new DataTexture(data, SIZE, SIZE, RGBAFormat, UnsignedByteType)
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  texture.name = 'softBlob'
  return texture
}

let cached: Texture | null = null

/** Vệt mờ dùng chung. Dựng một lần rồi tái dùng cho mọi lớp hiệu ứng. */
export function softTexture(): Texture {
  cached ??= buildSoftTexture()
  return cached
}
