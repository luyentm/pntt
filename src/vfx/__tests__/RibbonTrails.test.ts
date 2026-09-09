import { describe, expect, it } from 'vitest'
import { Mesh, PerspectiveCamera, type BufferAttribute } from 'three'
import { NO_TRAIL, RibbonTrailLayer, TRAIL_CAPACITY, TRAIL_SEGMENTS } from '../RibbonTrails'

/** Camera đứng cao và lệch sang một bên, để tích có hướng không suy biến. */
function makeCamera(): PerspectiveCamera {
  const cam = new PerspectiveCamera(50, 1.6, 0.1, 200)
  cam.position.set(12, 14, 12)
  cam.lookAt(0, 0, 0)
  cam.updateMatrixWorld()
  return cam
}

/**
 * Tra mesh theo TÊN, không theo chỉ số con.
 *
 * Từng có test của lớp hạt tra theo chỉ số, rồi thêm một dáng hạt mới là nó âm
 * thầm đo sai mesh mà vẫn xanh.
 */
function meshOf(layer: RibbonTrailLayer): Mesh {
  const found = layer.group.getObjectByName('vfx:trails:mesh')
  expect(found).toBeInstanceOf(Mesh)
  return found as Mesh
}

function attrs(layer: RibbonTrailLayer): { pos: BufferAttribute; col: BufferAttribute } {
  const geo = meshOf(layer).geometry
  return {
    pos: geo.getAttribute('position') as BufferAttribute,
    col: geo.getAttribute('color') as BufferAttribute,
  }
}

/** Alpha của đỉnh thứ `vertex` trong vệt thứ `trail`. */
function alphaAt(col: BufferAttribute, trail: number, vertex: number): number {
  return col.getW(trail * TRAIL_SEGMENTS * 2 + vertex)
}

describe('RibbonTrailLayer — handle', () => {
  it('handle rỗng thì mọi lời gọi là không làm gì', () => {
    const layer = new RibbonTrailLayer()
    expect(layer.isLive(NO_TRAIL)).toBe(false)
    // Không được ném lỗi
    layer.feed(NO_TRAIL, 1, 2, 3)
    layer.release(NO_TRAIL)
    expect(layer.isLive(-5)).toBe(false)
  })

  it('bám rồi thả thì handle chết theo', () => {
    const layer = new RibbonTrailLayer()
    const h = layer.attach({ fade: 0.2 })
    expect(layer.isLive(h)).toBe(true)
    layer.release(h)
    expect(layer.isLive(h)).toBe(false)
  })

  it('handle của vệt đã tan hết KHÔNG dùng lại được dù ô đã cấp cho vệt khác', () => {
    const layer = new RibbonTrailLayer()
    const cam = makeCamera()
    const old = layer.attach({ fade: 0.1 })
    layer.feed(old, 0, 0, 0)
    layer.feed(old, 1, 0, 0)
    layer.release(old)
    layer.update(0.2, cam) // quá 0.1s -> thu hồi

    // Ô đầu tiên giờ trống, nên vệt mới sẽ nhận đúng ô đó
    const fresh = layer.attach()
    expect(layer.isLive(fresh)).toBe(true)
    // Handle cũ vẫn phải chết: nếu chỉ so chỉ số ô thì nó sẽ "sống lại" và
    // ghi điểm vào vệt của chủ thể khác
    expect(layer.isLive(old)).toBe(false)
    layer.feed(old, 99, 99, 99)
  })
})

describe('RibbonTrailLayer — xương sống', () => {
  it('đầu vệt luôn đúng vị trí vừa đẩy, dù chưa đủ bước', () => {
    const layer = new RibbonTrailLayer()
    const cam = makeCamera()
    const h = layer.attach({ step: 1, width: 0.5, fade: 1 })
    layer.feed(h, 0, 0, 0)
    layer.feed(h, 0, 0, 5) // đủ xa -> có điểm thứ hai
    layer.feed(h, 0.1, 0, 5.1) // chưa đủ bước -> chỉ dịch đầu
    layer.update(0.016, cam)

    const { pos } = attrs(layer)
    // Hai đỉnh của điểm đầu nằm hai bên vị trí đầu vệt, nên trung điểm của chúng
    // phải chính là vị trí vừa đẩy
    const mx = (pos.getX(0) + pos.getX(1)) / 2
    const mz = (pos.getZ(0) + pos.getZ(1)) / 2
    expect(mx).toBeCloseTo(0.1, 4)
    expect(mz).toBeCloseTo(5.1, 4)
  })

  it('vệt dài ra khi đi từng bước NHỎ HƠN một bước chốt', () => {
    // Đây là lỗi thật đã gặp: bản đầu đo khoảng cách với chính điểm đầu, mà
    // điểm đầu bị ghi lại mỗi khung — nên mốc chạy theo đầu vệt và phép đo luôn
    // chỉ ra quãng đi trong MỘT khung. Vệt đứng nguyên một điểm mãi mãi.
    //
    // Test cũ đẩy các điểm cách nhau 5 unit nên mỗi khung đã vượt bước, và nó
    // xanh trong khi vệt trong game không hề dài ra.
    const layer = new RibbonTrailLayer()
    const cam = makeCamera()
    const step = 0.2
    const perFrame = 0.07 // xấp xỉ quãng đi một khung ở tốc độ chạy
    const h = layer.attach({ step, width: 0.4, fade: 5 })
    const frames = 60
    for (let i = 0; i < frames; i++) layer.feed(h, i * perFrame, 0, 0)
    layer.update(0.016, cam)

    const { pos } = attrs(layer)
    const headX = (pos.getX(0) + pos.getX(1)) / 2
    const tailIdx = (TRAIL_SEGMENTS - 1) * 2
    const tailX = (pos.getX(tailIdx) + pos.getX(tailIdx + 1)) / 2
    // Đầu vệt phải đúng vị trí cuối cùng đã đẩy
    expect(headX).toBeCloseTo((frames - 1) * perFrame, 4)
    // Và vệt phải đã trải hết chiều dài của nó, chứ không teo về một điểm
    expect(headX - tailX).toBeGreaterThan(step * (TRAIL_SEGMENTS - 2) * 0.9)
  })

  it('xương sống không dài hơn số đoạn dù đẩy bao nhiêu điểm', () => {
    const layer = new RibbonTrailLayer()
    const cam = makeCamera()
    const h = layer.attach({ step: 0.5, fade: 1 })
    for (let i = 0; i < TRAIL_SEGMENTS * 4; i++) layer.feed(h, i, 0, 0)
    layer.update(0.016, cam)

    const { pos } = attrs(layer)
    const headX = (pos.getX(0) + pos.getX(1)) / 2
    const tailIdx = (TRAIL_SEGMENTS - 1) * 2
    const tailX = (pos.getX(tailIdx) + pos.getX(tailIdx + 1)) / 2
    expect(headX).toBeCloseTo(TRAIL_SEGMENTS * 4 - 1, 4)
    // SEGMENTS - 2, không phải SEGMENTS - 1: mỗi bước ở đây (1 unit) đã vượt
    // `step` nên khung nào cũng chốt, và điểm vừa chốt trùng khít đầu vệt — nên
    // 18 điểm chỉ trải ra 16 bước. Xem ghi chú ở `feed`.
    expect(headX - tailX).toBeCloseTo(TRAIL_SEGMENTS - 2, 4)
  })

  it('points làm vệt NGẮN — thứ mà hạ step không làm được', () => {
    // Lỗi thật: 33 kiếm trúc quay nhanh hơn `step` mỗi khung, nên khung nào cũng
    // chốt điểm và giãn cách thật là quãng-đi-một-khung, không phải `step`. Hạ
    // `step` không ngắn được vệt, và ba vòng kiếm khép thành ba vòng tròn liền.
    const cam = makeCamera()
    const perFrame = 0.3 // đi nhanh hơn step 0.1 -> khung nào cũng chốt
    const doVet = (points?: number): number => {
      const layer = new RibbonTrailLayer()
      const h = layer.attach({ step: 0.1, width: 0.3, fade: 5, ...(points ? { points } : {}) })
      for (let i = 0; i < 40; i++) layer.feed(h, i * perFrame, 0, 0)
      layer.update(0.016, cam)
      const { pos } = attrs(layer)
      const head = (pos.getX(0) + pos.getX(1)) / 2
      let xa = head
      for (let i = 0; i < TRAIL_SEGMENTS; i++) {
        const mx = (pos.getX(i * 2) + pos.getX(i * 2 + 1)) / 2
        if (mx < xa) xa = mx
      }
      return head - xa
    }
    const dayDu = doVet()
    const ngan = doVet(7)
    // Hạ step KHÔNG ngắn được: vệt đầy đủ vẫn dài đúng 16 giãn cách thật
    expect(dayDu).toBeCloseTo((TRAIL_SEGMENTS - 2) * perFrame, 3)
    // Còn points thì ngắn được: 7 điểm chỉ trải 5 giãn cách (mất 1 vì điểm vừa
    // chốt trùng đầu vệt)
    expect(ngan).toBeCloseTo((7 - 2) * perFrame, 3)
  })

  it('đỉnh ngoài points bị gộp về điểm cuối và tắt alpha', () => {
    const layer = new RibbonTrailLayer()
    const cam = makeCamera()
    const h = layer.attach({ step: 0.1, opacity: 1, fade: 5, points: 6 })
    for (let i = 0; i < 30; i++) layer.feed(h, i * 0.3, 0, 0)
    layer.update(0.016, cam)

    const { pos, col } = attrs(layer)
    const cuoiX = (pos.getX(10) + pos.getX(11)) / 2 // điểm 5 = điểm cuối được dùng
    for (let i = 6; i < TRAIL_SEGMENTS; i++) {
      expect(alphaAt(col, 0, i * 2)).toBe(0)
      expect((pos.getX(i * 2) + pos.getX(i * 2 + 1)) / 2).toBeCloseTo(cuoiX, 4)
    }
  })

  it('mọi toạ độ đều hữu hạn kể cả khi mọi điểm trùng nhau', () => {
    const layer = new RibbonTrailLayer()
    const cam = makeCamera()
    const h = layer.attach({ step: 0.001, fade: 1 })
    // Đẩy hai điểm trùng khít: tiếp tuyến bằng 0, tích có hướng suy biến
    layer.feed(h, 3, 1, 3)
    layer.feed(h, 3, 1, 3)
    layer.update(0.016, cam)

    const { pos } = attrs(layer)
    for (let i = 0; i < TRAIL_SEGMENTS * 2; i++) {
      expect(Number.isFinite(pos.getX(i))).toBe(true)
      expect(Number.isFinite(pos.getY(i))).toBe(true)
      expect(Number.isFinite(pos.getZ(i))).toBe(true)
    }
  })

  it('camera nhìn dọc theo vệt thì dải vẫn có bề rộng', () => {
    const layer = new RibbonTrailLayer()
    const cam = new PerspectiveCamera(50, 1.6, 0.1, 200)
    // Vệt chạy theo +X, camera cũng nằm trên trục X -> hướng nhìn song song
    // tiếp tuyến, tích có hướng gần 0. Không có nhánh dự phòng thì dải teo thành
    // một đường chỉ và biến mất.
    cam.position.set(50, 0, 0)
    cam.lookAt(0, 0, 0)
    cam.updateMatrixWorld()

    const layerH = layer.attach({ step: 0.5, width: 0.4, fade: 1 })
    layer.feed(layerH, 0, 0, 0)
    layer.feed(layerH, 1, 0, 0)
    layer.feed(layerH, 2, 0, 0)
    layer.update(0.016, cam)

    const { pos } = attrs(layer)
    const spread = Math.hypot(
      pos.getX(0) - pos.getX(1),
      pos.getY(0) - pos.getY(1),
      pos.getZ(0) - pos.getZ(1),
    )
    expect(spread).toBeGreaterThan(0.1)
  })
})

describe('RibbonTrailLayer — gradient', () => {
  it('độ mờ giảm dần từ đầu về đuôi', () => {
    const layer = new RibbonTrailLayer()
    const cam = makeCamera()
    const h = layer.attach({ step: 0.3, opacity: 1, fade: 1 })
    for (let i = 0; i < TRAIL_SEGMENTS; i++) layer.feed(h, i * 0.4, 0, 0)
    layer.update(0.016, cam)

    const { col } = attrs(layer)
    const head = alphaAt(col, 0, 0)
    const mid = alphaAt(col, 0, TRAIL_SEGMENTS)
    const tail = alphaAt(col, 0, (TRAIL_SEGMENTS - 1) * 2)
    expect(head).toBeGreaterThan(mid)
    expect(mid).toBeGreaterThan(tail)
    expect(tail).toBeCloseTo(0, 5)
  })

  it('màu chạy từ màu đầu sang màu đuôi', () => {
    const layer = new RibbonTrailLayer()
    const cam = makeCamera()
    // Đầu đỏ thuần, đuôi lam thuần: kiểm được từng kênh không lẫn nhau
    const h = layer.attach({ head: 0xff0000, tail: 0x0000ff, step: 0.3, fade: 1 })
    for (let i = 0; i < TRAIL_SEGMENTS; i++) layer.feed(h, i * 0.4, 0, 0)
    layer.update(0.016, cam)

    const { col } = attrs(layer)
    expect(col.getX(0)).toBeCloseTo(1, 3) // R ở đầu
    expect(col.getZ(0)).toBeCloseTo(0, 3) // B ở đầu
    const tailV = (TRAIL_SEGMENTS - 1) * 2
    expect(col.getX(tailV)).toBeCloseTo(0, 3)
    expect(col.getZ(tailV)).toBeCloseTo(1, 3)
  })

  it('thả xong thì độ mờ giảm dần rồi vệt bị thu hồi', () => {
    const layer = new RibbonTrailLayer()
    const cam = makeCamera()
    const h = layer.attach({ step: 0.3, opacity: 1, fade: 0.4 })
    for (let i = 0; i < 6; i++) layer.feed(h, i * 0.4, 0, 0)
    layer.update(0.016, cam)
    const { col } = attrs(layer)
    const before = alphaAt(col, 0, 0)

    layer.release(h)
    layer.update(0.2, cam)
    const during = alphaAt(col, 0, 0)
    expect(during).toBeLessThan(before)
    expect(during).toBeGreaterThan(0)

    layer.update(0.3, cam) // tổng 0.5 > fade 0.4
    expect(alphaAt(col, 0, 0)).toBe(0)
    expect(layer.isLive(h)).toBe(false)
  })
})

describe('RibbonTrailLayer — vệt một lần', () => {
  it('strokeLine đặt hai đầu đúng chỗ và tự tan', () => {
    const layer = new RibbonTrailLayer()
    const cam = makeCamera()
    layer.strokeLine(0, 1, 0, 4, 1, 0, { width: 0.3, fade: 0.5 })
    layer.update(0.016, cam)

    const { pos } = attrs(layer)
    // strokeLine coi ĐIỂM ĐÍCH là đầu vệt: cú lướt sáng nhất ở chỗ vừa tới
    const headX = (pos.getX(0) + pos.getX(1)) / 2
    const tailIdx = (TRAIL_SEGMENTS - 1) * 2
    const tailX = (pos.getX(tailIdx) + pos.getX(tailIdx + 1)) / 2
    expect(headX).toBeCloseTo(4, 4)
    expect(tailX).toBeCloseTo(0, 4)
  })

  it('strokeArc nằm trên cung bán kính cho trước và đảo được chiều', () => {
    const layer = new RibbonTrailLayer()
    const cam = makeCamera()
    const cx = 2
    const cz = -3
    const radius = 1.5
    layer.strokeArc(cx, 0, cz, 0, radius, 1, false, { width: 0.01, fade: 1 })
    layer.update(0.016, cam)

    const { pos } = attrs(layer)
    for (let i = 0; i < TRAIL_SEGMENTS; i++) {
      const mx = (pos.getX(i * 2) + pos.getX(i * 2 + 1)) / 2
      const mz = (pos.getZ(i * 2) + pos.getZ(i * 2 + 1)) / 2
      expect(Math.hypot(mx - cx, mz - cz)).toBeCloseTo(radius, 1)
    }

    // Đảo chiều thì đầu cung nhảy sang phía bên kia
    const headX = (pos.getX(0) + pos.getX(1)) / 2
    const layer2 = new RibbonTrailLayer()
    layer2.strokeArc(cx, 0, cz, 0, radius, 1, true, { width: 0.01, fade: 1 })
    layer2.update(0.016, cam)
    const headX2 =
      (attrs(layer2).pos.getX(0) + attrs(layer2).pos.getX(1)) / 2
    expect(Math.sign(headX - cx)).toBe(-Math.sign(headX2 - cx))
  })

  it('đường ngắn hơn hai điểm bị bỏ qua', () => {
    const layer = new RibbonTrailLayer()
    const cam = makeCamera()
    layer.strokePath([1, 1, 1], 1, { opacity: 1, fade: 1 })
    layer.update(0.016, cam)
    expect(alphaAt(attrs(layer).col, 0, 0)).toBe(0)
  })
})

describe('RibbonTrailLayer — hồ', () => {
  it('hết chỗ thì cắt vệt ĐANG TAN trước, không cắt vệt đang bám', () => {
    const layer = new RibbonTrailLayer()
    const cam = makeCamera()
    // Lấp đầy hồ bằng các vệt đang bám
    const live: number[] = []
    for (let i = 0; i < TRAIL_CAPACITY; i++) live.push(layer.attach({ fade: 5 }))
    // Thả một cái ở giữa
    layer.release(live[7]!)
    layer.update(0.016, cam)

    const extra = layer.attach()
    expect(layer.isLive(extra)).toBe(true)
    // Mọi vệt đang bám khác vẫn phải còn sống
    for (let i = 0; i < TRAIL_CAPACITY; i++) {
      if (i === 7) continue
      expect(layer.isLive(live[i]!)).toBe(true)
    }
  })

  it('mọi vệt đều đang bám thì cắt cái cũ nhất', () => {
    const layer = new RibbonTrailLayer()
    const cam = makeCamera()
    const live: number[] = []
    for (let i = 0; i < TRAIL_CAPACITY; i++) {
      live.push(layer.attach({ fade: 5 }))
      layer.update(0.016, cam) // mỗi cái già hơn cái sau một khung
    }
    const extra = layer.attach()
    expect(layer.isLive(extra)).toBe(true)
    expect(layer.isLive(live[0]!)).toBe(false)
    expect(layer.isLive(live[TRAIL_CAPACITY - 1]!)).toBe(true)
  })
})
