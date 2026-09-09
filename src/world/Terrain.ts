import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  Vector3,
  type Material,
} from 'three'
import { Palette } from '@/art/Palette'
import { Noise2D } from '@/core/noise'
import type { Rng } from '@/core/Rng'
import { materials } from '@/render/Materials'

/**
 * Chỉ cần biết cao độ tại một điểm. Player và AI phụ thuộc vào interface này chứ
 * không phụ thuộc Terrain, nên sau này đổi sang địa hình khác (hang động, đảo bay
 * ở Thiên Nam) không phải sửa chúng.
 */
export interface HeightField {
  heightAt(x: number, z: number): number
}

export interface TerrainOptions {
  /** Chiều rộng bản đồ (world unit). */
  size?: number
  /** Số ô mỗi cạnh. Ô càng lớn thì facet càng rõ — đó là chất lowpoly muốn có. */
  segments?: number
  /** Bán kính vùng phẳng tuyệt đối ở giữa (khu chiến đấu). */
  flatRadius?: number
  /** Ra ngoài bán kính này thì địa hình gợn hết biên độ. */
  rollRadius?: number
  amplitude?: number
  /** Độ dốc tối đa còn đi được, tính bằng độ. */
  maxWalkableSlope?: number
}

/**
 * Địa hình heightfield lowpoly.
 *
 * Lưới được dựng THỦ CÔNG chứ không dùng PlaneGeometry, để biết chắc mỗi ô được
 * chia thành hai tam giác theo đường chéo nào. Nhờ vậy `heightAt()` nội suy đúng
 * trên tam giác mà điểm đó rơi vào, tức trả về CHÍNH XÁC cao độ của mặt được vẽ —
 * bàn chân nhân vật không bao giờ lún hay lơ lửng. Dùng PlaneGeometry thì phải
 * suy ngược thứ tự index của three và mọi thay đổi phiên bản đều có thể làm lệch.
 */
export class Terrain implements HeightField {
  readonly mesh: Mesh
  readonly size: number
  readonly segments: number
  readonly cell: number

  private readonly half: number
  private readonly stride: number
  /** Cao độ tại các đỉnh lưới, index = ix + stride * iz. */
  private readonly heights: Float32Array
  private readonly noise: Noise2D
  private readonly flatRadius: number
  private readonly rollRadius: number
  private readonly amplitude: number
  private readonly minWalkableNormalY: number

  private readonly tmpA = new Vector3()
  private readonly tmpB = new Vector3()

  constructor(rng: Rng, options: TerrainOptions = {}) {
    this.size = options.size ?? 240
    this.segments = options.segments ?? 72
    this.flatRadius = options.flatRadius ?? 12
    this.rollRadius = options.rollRadius ?? 32
    this.amplitude = options.amplitude ?? 5.5
    this.minWalkableNormalY = Math.cos(((options.maxWalkableSlope ?? 38) * Math.PI) / 180)

    this.half = this.size / 2
    this.cell = this.size / this.segments
    this.stride = this.segments + 1
    this.noise = new Noise2D(rng)

    this.heights = new Float32Array(this.stride * this.stride)
    for (let iz = 0; iz < this.stride; iz++) {
      for (let ix = 0; ix < this.stride; ix++) {
        const x = -this.half + ix * this.cell
        const z = -this.half + iz * this.cell
        this.heights[ix + this.stride * iz] = this.sampleHeightFunction(x, z)
      }
    }

    this.mesh = this.buildMesh()
  }

  /** Hàm cao độ gốc. Chỉ dùng lúc dựng lưới — lúc chạy luôn dùng `heightAt()`. */
  private sampleHeightFunction(x: number, z: number): number {
    const d = Math.hypot(x, z)

    // Vùng phẳng phải được NEO THEO LƯỚI, không theo bán kính danh nghĩa.
    //
    // heightAt() nội suy từ các ĐỈNH LƯỚI. Nếu chỉ ép height = 0 cho d <=
    // flatRadius thì ô nào vắt qua biên sẽ có đỉnh ngoài đã nhô lên, và tam giác
    // của nó nghiêng lấn vào phía trong biên — vùng "phẳng" hoá ra vẫn nghiêng
    // vài milimet. Đỉnh xa nhất của ô chứa một điểm cách điểm đó tối đa
    // cell·√2, nên nới thêm 1.5·cell là bảo đảm mọi ô nằm trong flatRadius đều
    // có CẢ BỐN đỉnh bằng 0.
    const flatInner = this.flatRadius + this.cell * 1.5
    const t = Math.min(1, Math.max(0, (d - flatInner) / (this.rollRadius - flatInner)))
    if (t <= 0) return 0
    // Smoothstep chứ không tuyến tính: nội suy tuyến tính để lại nếp gấp ở CẢ HAI
    // đầu vùng chuyển, và nếp ở đầu ngoài hiện lên thành một cái vành tròn trông
    // như bờ cao nguyên nhân tạo giữa cảnh núi
    const flatten = t * t * (3 - 2 * t)

    const hills = this.noise.fbm(x * 0.012, z * 0.012, 4)
    const detail = this.noise.fbm(x * 0.038 + 100, z * 0.038 - 50, 2)

    // Núi vòng ngoài dâng dần: cho cảm giác sơn môn nằm trong lòng núi, và tạo
    // đường chân trời có hình khi người chơi hạ camera xuống thấp
    const far = Math.min(1, Math.max(0, (d - 52) / 58))

    return (hills * this.amplitude + detail * this.amplitude * 0.28 + far * far * 19) * flatten
  }

  private index(ix: number, iz: number): number {
    return ix + this.stride * iz
  }

  private gridHeight(ix: number, iz: number): number {
    const cx = Math.min(this.segments, Math.max(0, ix))
    const cz = Math.min(this.segments, Math.max(0, iz))
    return this.heights[this.index(cx, cz)] as number
  }

  /**
   * Cao độ chính xác của mặt được vẽ tại (x, z).
   *
   * Mỗi ô gồm hai tam giác chia theo đường chéo từ (ix, iz+1) tới (ix+1, iz):
   *   u + v <= 1  ->  tam giác (00, 01, 10)
   *   u + v >= 1  ->  tam giác (01, 11, 10)
   * Nội suy tuyến tính trên đúng tam giác chứa điểm, nên kết quả nằm đúng trên
   * mặt phẳng của tam giác đó — không phải xấp xỉ bilinear.
   */
  heightAt(x: number, z: number): number {
    const fx = (x + this.half) / this.cell
    const fz = (z + this.half) / this.cell
    const ix = Math.min(this.segments - 1, Math.max(0, Math.floor(fx)))
    const iz = Math.min(this.segments - 1, Math.max(0, Math.floor(fz)))
    const u = Math.min(1, Math.max(0, fx - ix))
    const v = Math.min(1, Math.max(0, fz - iz))

    const h00 = this.gridHeight(ix, iz)
    const h01 = this.gridHeight(ix, iz + 1)
    const h10 = this.gridHeight(ix + 1, iz)

    if (u + v <= 1) {
      return h00 + (h10 - h00) * u + (h01 - h00) * v
    }
    const h11 = this.gridHeight(ix + 1, iz + 1)
    return h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v)
  }

  /** Pháp tuyến của tam giác chứa (x, z). */
  normalAt(x: number, z: number, out: Vector3): Vector3 {
    // Suy từ chính heightAt() nên pháp tuyến luôn khớp với mặt được vẽ
    const e = this.cell * 0.5
    const hL = this.heightAt(x - e, z)
    const hR = this.heightAt(x + e, z)
    const hD = this.heightAt(x, z - e)
    const hU = this.heightAt(x, z + e)
    this.tmpA.set(2 * e, hR - hL, 0)
    this.tmpB.set(0, hU - hD, 2 * e)
    return out.crossVectors(this.tmpB, this.tmpA).normalize()
  }

  /** Độ dốc 0..1 (0 = phẳng, 1 = dựng đứng). */
  slopeAt(x: number, z: number): number {
    const n = this.normalAt(x, z, this.tmpA.clone())
    return 1 - Math.min(1, Math.max(0, n.y))
  }

  /** Chỗ quá dốc thì quái và người chơi không đi được — dữ liệu cho navmesh của yuka. */
  isWalkable(x: number, z: number): boolean {
    if (Math.abs(x) > this.half - this.cell || Math.abs(z) > this.half - this.cell) return false
    const n = this.normalAt(x, z, this.tmpB)
    return n.y >= this.minWalkableNormalY
  }

  private buildMesh(): Mesh {
    const quads = this.segments * this.segments
    const vertexCount = quads * 6
    const positions = new Float32Array(vertexCount * 3)
    const colors = new Float32Array(vertexCount * 3)

    const co = new Color(Palette.co)
    const coDam = new Color(Palette.coDam)
    const coKho = new Color(Palette.coKho)
    const da = new Color(Palette.da)
    const tmp = new Color()

    let p = 0
    let c = 0

    // Ghi một đỉnh. Màu suy từ cao độ + độ dốc + NHIỄU HAI TẦN SỐ.
    //
    // Cao độ và độ dốc là chưa đủ, và đó là một lỗi thật đã thấy trên màn hình:
    // cả luyện võ trường nằm trong VÙNG PHẲNG, nên `y` và `steep` đều là hằng số
    // ở đó — cả sân ra đúng MỘT màu xanh, và không cấu hình ánh sáng nào chữa được
    // một mặt phẳng một màu. Đó chính là nguyên nhân lớn nhất của cảm giác
    // "nhạt nhoà", chứ không phải cường độ đèn.
    //
    // Hai tần số: một dải rộng (~0.02) cho từng vạt cỏ đậm nhạt khác nhau, và một
    // dải hẹp (~0.09) cho lấm tấm trong từng vạt. Cùng một `Noise2D` đã dùng cho
    // cao độ nhưng LỆCH GỐC, nếu không thì vạt màu sẽ trùng khít với gò đất và
    // trông như tô theo đường bình độ.
    const push = (x: number, y: number, z: number, steep: number): void => {
      positions[p++] = x
      positions[p++] = y
      positions[p++] = z

      const broad = this.noise.fbm(x * 0.02 + 610, z * 0.02 - 430, 3)
      const fine = this.noise.fbm(x * 0.09 - 210, z * 0.09 + 880, 2)
      // Tần số hẹp được ăn NẶNG hơn: nó mới là thứ biến thiên trong phạm vi một
      // sân đấu. Tần số rộng gần như là hằng số ở quy mô đó nên chỉ đóng vai một
      // sắc nền cho từng vùng bản đồ.
      const patch = broad * 0.45 + fine * 0.55

      const t = Math.min(1, Math.max(0, (y + 3) / 14))
      if (t < 0.45) tmp.copy(coDam).lerp(co, t / 0.45)
      else tmp.copy(co).lerp(coKho, (t - 0.45) / 0.55)

      // Vạt dương ngả cỏ khô, vạt âm ngả cỏ đậm — biến thiên cả sắc lẫn độ sáng,
      // không chỉ làm sáng/tối một màu. Đổi độ sáng suông thì mặt đất trông như
      // bị bẩn, còn đổi cả sắc thì ra vạt cỏ.
      // Hệ số 2.2/2.4 dò bằng cách ĐO: ở 0.5/0.62 thì dải sáng trong sân chỉ có
      // 0.008 — tức là mắt không thấy gì và cả sân vẫn ra một màu.
      if (patch > 0) tmp.lerp(coKho, Math.min(1, patch * 2.2))
      else tmp.lerp(coDam, Math.min(1, -patch * 2.4))

      tmp.lerp(da, Math.min(1, Math.max(0, (steep - 0.3) / 0.4)))

      colors[c++] = tmp.r
      colors[c++] = tmp.g
      colors[c++] = tmp.b
    }

    for (let iz = 0; iz < this.segments; iz++) {
      for (let ix = 0; ix < this.segments; ix++) {
        const x0 = -this.half + ix * this.cell
        const z0 = -this.half + iz * this.cell
        const x1 = x0 + this.cell
        const z1 = z0 + this.cell

        const h00 = this.gridHeight(ix, iz)
        const h10 = this.gridHeight(ix + 1, iz)
        const h01 = this.gridHeight(ix, iz + 1)
        const h11 = this.gridHeight(ix + 1, iz + 1)

        // Độ dốc của ô, suy từ chênh lệch cao độ trên đường chéo
        const drop = Math.max(Math.abs(h11 - h00), Math.abs(h01 - h10))
        const steep = Math.min(1, drop / (this.cell * 1.2))

        // Thứ tự đỉnh cho pháp tuyến hướng LÊN (đã kiểm bằng tích có hướng):
        //   (00, 01, 10) và (01, 11, 10)
        push(x0, h00, z0, steep)
        push(x0, h01, z1, steep)
        push(x1, h10, z0, steep)

        push(x0, h01, z1, steep)
        push(x1, h11, z1, steep)
        push(x1, h10, z0, steep)
      }
    }

    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    geometry.setAttribute('color', new BufferAttribute(colors, 3))
    geometry.computeVertexNormals()

    const material: Material = materials.flat(0xffffff, { vertexColors: true })
    const mesh = new Mesh(geometry, material)
    mesh.name = 'terrain'
    mesh.receiveShadow = true
    return mesh
  }

  dispose(): void {
    this.mesh.geometry.dispose()
  }
}
