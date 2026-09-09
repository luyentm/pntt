import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  type ColorRepresentation,
} from 'three'
import { Palette } from '@/art/Palette'
import { VfxPool, type Poolable } from './VfxPool'

interface Aura extends Poolable {
  ring: Mesh
  material: MeshBasicMaterial
  from: number
  to: number
  peak: number
}

/**
 * Vòng phẳng nằm trong mặt phẳng XZ, bán kính 1.
 *
 * 9 cạnh chứ không 20 như vòng của `AreaBurstLayer`: ở bán kính nhỏ dưới chân
 * thì 20 cạnh đọc ra là một vòng tròn nhẵn — trơn tuột giữa một cảnh mà mọi thứ
 * khác đều có mặt cắt. 9 cạnh vẫn ra vòng nhưng thấy được góc, nên nó thuộc về
 * cùng thế giới với những khối lowpoly quanh nó.
 *
 * Vành 0.38 bán kính. Thử 0.52 khi tưởng vòng bị mờ quá: hoá ra nó không mờ mà
 * bị sàn che, và khi sửa đúng nguyên nhân thì vành dày đó đọc ra là một cái bánh
 * xe đặc chứ không phải hào quang. Mảnh hơn nữa (0.25) thì ở bán kính dưới một
 * unit vành chỉ còn vài pixel.
 */
function auraRingGeometry(segments = 9, thickness = 0.38): BufferGeometry {
  const positions: number[] = []
  const inner = 1 - thickness
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2
    const a1 = ((i + 1) / segments) * Math.PI * 2
    const c0 = Math.cos(a0)
    const s0 = Math.sin(a0)
    const c1 = Math.cos(a1)
    const s1 = Math.sin(a1)
    positions.push(c0 * inner, 0, s0 * inner, c0, 0, s0, c1, 0, s1)
    positions.push(c0 * inner, 0, s0 * inner, c1, 0, s1, c1 * inner, 0, s1 * inner)
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geo.computeVertexNormals()
  return geo
}

export interface AuraOptions {
  color?: ColorRepresentation
  /** Bán kính lúc hiện ra. */
  from?: number
  /** Bán kính lúc tan. */
  to?: number
  life?: number
  /** Độ chói lớn nhất. */
  peak?: number
}

/**
 * Hào quang dưới chân: vòng linh khí loang ra rồi tan.
 *
 * ## Vì sao là lớp riêng, không dùng lại `AreaBurstLayer`
 *
 * Về hình học thì y hệt — một vòng phẳng loang ra. Nhưng NHỊP dùng khác hẳn:
 * `AreaBurstLayer` nhả một vòng cho mỗi vụ nổ, còn lớp này nhả một vòng cứ mỗi
 * bước chân, tức khoảng 5 vòng mỗi giây suốt cả lượt chơi. Chung hồ thì mấy cái
 * vòng dưới chân sẽ giành hết 12 ô và mọi vụ nổ pháp vực đều bị cắt vòng —
 * người chơi mất đúng cái thứ nói cho họ biết tầm của chiêu.
 *
 * ## Vì sao vòng loang ra chứ không phải một đốm sáng đứng yên
 *
 * Thử một đĩa sáng bám dưới chân trước: nó trùng ngay với ô chọn mục tiêu và
 * vòng chỉ dẫn vốn đã có ở cảnh, nên đọc ra là "nhân vật đang được chọn" chứ
 * không phải "linh khí đang toả". Vòng LOANG RA thì không lẫn với gì cả, vì
 * không có thứ nào khác dưới chân biết nở ra.
 */
export class FootAuraLayer {
  readonly group = new Group()
  private readonly pool: VfxPool<Aura>

  constructor(capacity = 10) {
    this.group.name = 'vfx:footAura'
    const geometry = auraRingGeometry()

    this.pool = new VfxPool<Aura>(capacity, () => {
      const material = new MeshBasicMaterial({
        color: Palette.vetLuc,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        // DoubleSide, và nó là BẮT BUỘC chứ không phải cho chắc. Thứ tự đỉnh ở
        // trên cho pháp tuyến hướng XUỐNG (−Y): tích có hướng của hai cạnh đầu
        // tam giác ra (0, −0.22, 0). Camera nhìn từ trên nên nó thấy mặt sau, và
        // `FrontSide` cull sạch — vòng vẫn tốn một draw call, mọi chỉ số
        // (visible, opacity, scale, vị trí) vẫn đúng, mà màn hình trống trơn.
        // Với một vòng phẳng vẽ bằng phép cộng thì mặt trước hay sau không có
        // nghĩa gì, nên vẽ cả hai mặt là câu trả lời đúng, không phải đảo winding.
        side: DoubleSide,
        toneMapped: false, // giữ độ chói để bloom bắt được
      })
      const ring = new Mesh(geometry, material)
      ring.visible = false
      ring.renderOrder = 7
      ring.frustumCulled = false
      this.group.add(ring)
      return { active: false, age: 0, life: 0.5, ring, material, from: 0.2, to: 0.9, peak: 0.5 }
    })
  }

  spawn(x: number, y: number, z: number, options: AuraOptions = {}): void {
    const a = this.pool.acquire()
    a.life = options.life ?? 0.46
    a.from = options.from ?? 0.22
    a.to = options.to ?? 0.9
    a.peak = options.peak ?? 0.5
    a.material.color.set(options.color ?? Palette.vetLuc)
    // Nhấc lên 0.14, và con số này là ĐO ĐƯỢC, không phải chọn cho chắc.
    //
    // `y` truyền vào là cao độ ĐỊA HÌNH dưới chân nhân vật, còn sàn đá của luyện
    // võ trường là một prop nằm TRÊN địa hình: mặt trên của nó ở y = 0.056. Bản
    // đầu tôi nhấc 0.05 — thiếu đúng sáu phần nghìn unit — nên vòng nằm dưới sàn
    // và bị che sạch trên toàn bộ khu vực người chơi ở nhiều nhất. Mọi chỉ số
    // vẫn đúng (visible, opacity 0.7, scale 1.3), màn hình vẫn trống.
    //
    // 0.14 vượt sàn một khoảng thoải mái mà ở khoảng cách camera iso vẫn đọc ra
    // là "sát đất".
    a.ring.position.set(x, y + 0.14, z)
    a.ring.scale.set(a.from, 1, a.from)
    a.ring.visible = true
    a.material.opacity = a.peak
  }

  update(dt: number): void {
    this.pool.update(
      dt,
      (a, progress) => {
        // Nở NHANH rồi chậm lại: sóng linh khí bật ra rồi mất đà. Nở đều tay thì
        // đọc ra là một cái vòng được kéo giãn, không phải một cái gì lan ra.
        const eased = 1 - (1 - progress) ** 2.2
        const r = a.from + (a.to - a.from) * eased
        a.ring.scale.set(r, 1, r)
        // Số mũ 1.0, không phải 1.5: ở 1.5 thì hơn nửa vòng đời vòng đã mờ dưới
        // mức thấy được trên nền sáng, nên hiệu ứng chỉ loé một cái rồi mất
        a.material.opacity = a.peak * (1 - progress)
      },
      (a) => {
        a.ring.visible = false
        a.material.opacity = 0
      },
    )
  }

  dispose(): void {
    for (const a of this.pool.all) a.material.dispose()
    this.pool.all[0]?.ring.geometry.dispose()
  }
}
