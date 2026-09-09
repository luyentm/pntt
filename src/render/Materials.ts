import {
  Color,
  DoubleSide,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshToonMaterial,
  type ColorRepresentation,
  type Material,
} from 'three'

export interface FlatOptions {
  /** Vẽ cả hai mặt — dùng cho lá cây / vạt áo mỏng. */
  doubleSide?: boolean
  transparent?: boolean
  opacity?: number
  /** Bật khi geometry mang màu ở vertex (prop đã merge). */
  vertexColors?: boolean
}

/**
 * Kho material dùng chung, cache theo khoá.
 * Chia sẻ material là cách rẻ nhất để giảm state change của WebGL: hàng trăm khối
 * cùng màu chỉ tốn một material. Toàn bộ đều `flatShading` — đó chính là thứ tạo ra
 * các mặt cắt sắc nét của phong cách lowpoly.
 */
class MaterialCache {
  private readonly cache = new Map<string, Material>()

  private key(kind: string, color: ColorRepresentation, o: FlatOptions = {}): string {
    const hex = new Color(color).getHexString()
    return [
      kind,
      hex,
      o.doubleSide ? 'ds' : '',
      o.transparent ? `tr${o.opacity ?? 1}` : '',
      o.vertexColors ? 'vc' : '',
    ].join('|')
  }

  /** Lambert phẳng — vật liệu mặc định của game. Rẻ hơn Standard, nhận sáng + đổ bóng. */
  flat(color: ColorRepresentation, o: FlatOptions = {}): MeshLambertMaterial {
    const k = this.key('flat', color, o)
    let m = this.cache.get(k) as MeshLambertMaterial | undefined
    if (!m) {
      m = new MeshLambertMaterial({
        color,
        flatShading: true,
        // three cảnh báo nếu nhận side: undefined -> chỉ đặt key khi thực sự cần
        ...(o.doubleSide ? { side: DoubleSide } : {}),
        transparent: o.transparent ?? false,
        opacity: o.opacity ?? 1,
        vertexColors: o.vertexColors ?? false,
      })
      this.cache.set(k, m)
    }
    return m
  }

  /** Toon — có dải sáng rõ rệt, dùng cho nhân vật để tăng chất "cute". */
  toon(color: ColorRepresentation, o: FlatOptions = {}): MeshToonMaterial {
    const k = this.key('toon', color, o)
    let m = this.cache.get(k) as MeshToonMaterial | undefined
    if (!m) {
      m = new MeshToonMaterial({
        color,
        ...(o.doubleSide ? { side: DoubleSide } : {}),
        transparent: o.transparent ?? false,
        opacity: o.opacity ?? 1,
        vertexColors: o.vertexColors ?? false,
      })
      this.cache.set(k, m)
    }
    return m
  }

  /** Không nhận sáng — dùng cho VFX phát sáng, mắt, và mọi thứ cần rực lên qua bloom. */
  glow(color: ColorRepresentation, opacity = 1): MeshBasicMaterial {
    const k = this.key('glow', color, { opacity, transparent: opacity < 1 })
    let m = this.cache.get(k) as MeshBasicMaterial | undefined
    if (!m) {
      m = new MeshBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
        toneMapped: false, // giữ nguyên độ chói để bloom bắt được
      })
      this.cache.set(k, m)
    }
    return m
  }

  get size(): number {
    return this.cache.size
  }

  dispose(): void {
    for (const m of this.cache.values()) m.dispose()
    this.cache.clear()
  }
}

export const materials = new MaterialCache()
