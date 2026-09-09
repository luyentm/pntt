import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  SphereGeometry,
} from 'three'
import { Animator } from '@/anim/Clip'
import { RigBuilder } from '@/anim/Rig'
import { materials } from '@/render/Materials'
import { Palette } from '@/art/Palette'
import { CHIBI_RIG, type ChibiJoint } from '@/art/ChibiRig'
import type { Chibi } from '@/art/buildChibi'

/**
 * Bảng màu của Hàn Lập, lấy từ bản thiết kế nguyên mẫu.
 *
 * Để cục bộ trong file này chứ không rải vào `Palette`: đây là màu của MỘT nhân
 * vật, không phải tông chung của game. Đưa lên `Palette` thì lần sau ai đó cần
 * "một màu trắng ngà" sẽ với tay lấy đúng màu áo Hàn Lập, và từ đó đổi áo hắn
 * là đổi luôn một cái tường đá ở đâu đó.
 */
const C = {
  /** Đạo bào ngoài — trắng ngà. */
  bao: 0xece8db,
  /** Mặt khuất và vạt dưới của bào — trắng ngà tối một bậc. */
  baoDam: 0xcdc8b6,
  /** Lót trong và các mảng lam. */
  lam: 0x5588bb,
  /** Lam sẫm cho viền và nếp gấp. */
  lamDam: 0x3a6791,
  /** Đai lưng. */
  dai: 0xdcd7c6,
  toc: 0x1b202a,
  /** Tóc bắt sáng — dùng cho vài phiến ở mặt trên búi và mái. */
  tocSang: 0x2b3346,
  da: Palette.daNguoi,
  daToi: 0xdcb086,
  hia: 0x2b3038,
  kim: Palette.kim,
  mat: 0x161a22,
  sangMat: 0xf2f6ff,
  moi: 0x9c5f52,
} as const

/**
 * Hàn Lập — nhân vật người chơi, dựng riêng và CHO PHÉP nhiều tam giác.
 *
 * Vì sao tách khỏi `buildChibi` thay vì thêm cờ vào đó:
 *
 * `buildChibi` tồn tại để dựng HÀNG CHỤC đơn vị cùng lúc — mỗi con một draw
 * call, và ngân sách tam giác của nó là ngân sách của cả một đợt quái. Hàn Lập
 * thì chỉ có MỘT trên màn hình, luôn ở giữa khung, và là thứ người chơi nhìn
 * suốt cả lượt chơi. Hai bài toán ngược nhau, nên nhồi cả hai vào một hàm sẽ
 * kéo một trong hai về phía sai: hoặc quái đắt lên vô cớ, hoặc nhân vật chính
 * mãi mãi bị giới hạn bởi ngân sách của quái.
 *
 * Tách ra thì `buildChibi` giữ nguyên đúng vai cũ, còn ở đây mặt cầu đi từ 7×5
 * lên 16×12, tóc có mái chẻ và tóc mai riêng từng lọn, áo có giao lĩnh thật với
 * lớp lót lam, và đai lưng có nút thắt kèm hai dải buông.
 *
 * Vẫn là MỘT `SkinnedMesh` và MỘT draw call, y như mọi nhân vật khác: rigid
 * skinning không quan tâm có bao nhiêu khối, chỉ quan tâm mỗi khối thuộc về
 * xương nào.
 */
export function buildHanLap(): Chibi {
  const b = new RigBuilder(CHIBI_RIG)

  buildHead(b)
  buildTorso(b)
  buildSkirt(b)
  buildLegs(b)
  buildArms(b)

  const material = materials.flat(0xffffff, { vertexColors: true })
  const { mesh, skeleton } = b.finish(material, 'HanLap')

  const root = new Group()
  root.name = 'HanLap:root'
  root.add(mesh)

  return {
    root,
    mesh,
    bones: skeleton.bones,
    animator: new Animator(CHIBI_RIG, skeleton.bones),
    height: 1.1,
  }
}

// ────────────────────────────────── Đầu ──────────────────────────────────

function buildHead(b: RigBuilder<ChibiJoint>): void {
  // Sọ 16×12 thay vì 7×5. Ở cỡ này facet vẫn thấy được nhưng đường bao đã tròn,
  // và đó đúng là thứ bản thiết kế vẽ: mặt mềm, không phải khối đa diện.
  const skull = new SphereGeometry(0.236, 16, 12)
  skull.scale(1, 0.99, 0.95)
  skull.translate(0, 0.225, 0)
  b.add('head', skull, C.da)

  // Vòm tóc KÍN, rồi tấm mặt bán kính lớn hơn khoét ra phía trước — cùng thủ
  // pháp với `buildChibi` vì nó đúng, chỉ tăng độ phân giải
  const dome = new SphereGeometry(0.25, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.63)
  dome.scale(1, 1.02, 1)
  dome.translate(0, 0.222, 0)
  b.add('head', dome, C.toc)

  const face = new SphereGeometry(0.255, 18, 12, 0, Math.PI, Math.PI * 0.44, Math.PI * 0.36)
  face.translate(0, 0.222, 0)
  b.add('head', face, C.da)

  buildFringe(b)
  buildSideLocks(b)
  buildPonytail(b)
  buildFace(b)
}

/**
 * Mái chẻ giữa — năm lọn nhọn rủ xuống trán.
 *
 * Từng lọn RIÊNG chứ không một tấm liền: chỗ hai lọn gặp nhau tạo một rãnh, và
 * chính mấy cái rãnh đó là thứ đọc ra là tóc. Một tấm liền dù cong đẹp tới đâu
 * cũng chỉ ra một cái mũ.
 *
 * Lọn giữa NGẮN nhất và hai lọn ngoài dài nhất: đó là hình chữ V ngược của mái
 * chẻ giữa, và nó mở khuôn mặt ra thay vì che kín trán.
 */
function buildFringe(b: RigBuilder<ChibiJoint>): void {
  const LOCKS: ReadonlyArray<readonly [number, number, number, number]> = [
    // [góc quanh trục Y, dài, rộng, nghiêng]
    [0, 0.1, 0.07, 0],
    [0.34, 0.15, 0.075, 0.18],
    [-0.34, 0.15, 0.075, -0.18],
    [0.68, 0.2, 0.08, 0.34],
    [-0.68, 0.2, 0.08, -0.34],
    [1.0, 0.23, 0.075, 0.5],
    [-1.0, 0.23, 0.075, -0.5],
  ]
  for (const [angle, len, width, tilt] of LOCKS) {
    // Thân lọn: hình nêm bám vào mặt cầu sọ
    const lock = new ConeGeometry(width * 0.62, len, 4)
    lock.rotateX(Math.PI)
    lock.scale(1, 1, 0.55)
    lock.translate(0, -len / 2, 0)
    lock.rotateZ(tilt)
    // Đưa ra mặt cầu bán kính 0.252 quanh tâm đầu, ở cao độ chân tóc
    const r = 0.252
    const y = 0.222 + Math.cos(0.62) * r * 0.72
    lock.translate(Math.sin(angle) * r * 0.78, y, Math.cos(angle) * r * 0.72)
    b.add('head', lock, C.toc)
  }

  // Hai phiến bắt sáng trên đỉnh mái — nếu cả khối tóc cùng một màu thì ở góc
  // iso nó thành một mảng đen phẳng, mất hết hình khối vừa dựng
  for (const side of [-1, 1]) {
    const sheen = new BoxGeometry(0.1, 0.02, 0.13)
    sheen.rotateZ(side * 0.24)
    sheen.rotateX(-0.5)
    sheen.translate(side * 0.085, 0.395, 0.16)
    b.add('head', sheen, C.tocSang)
  }
}

/**
 * Hai lọn tóc mai buông trước tai, xuống quá cằm rồi vuốt nhọn.
 *
 * Chúng làm khuôn mặt HẸP lại. Mặt chibi là một khối cầu, và hai dải tối hai
 * bên là cách duy nhất cho nó một đường viền mà không phải bóp méo hình cầu —
 * bóp méo thì mất luôn cái tròn trịa vốn là toàn bộ chất "chibi".
 */
function buildSideLocks(b: RigBuilder<ChibiJoint>): void {
  for (const side of [-1, 1]) {
    const SEGS: ReadonlyArray<readonly [number, number, number]> = [
      // [y, bán kính, z]
      [0.26, 0.042, 0.05],
      [0.16, 0.045, 0.062],
      [0.05, 0.042, 0.066],
      [-0.06, 0.034, 0.062],
      [-0.16, 0.024, 0.054],
    ]
    for (let i = 0; i < SEGS.length - 1; i++) {
      const [y0, r0, z0] = SEGS[i] as readonly [number, number, number]
      const [y1, r1, z1] = SEGS[i + 1] as readonly [number, number, number]
      const len = Math.hypot(y1 - y0, z1 - z0)
      const seg = new CylinderGeometry(r1, r0, len * 1.08, 6)
      seg.scale(0.78, 1, 1)
      seg.rotateX(Math.atan2(z1 - z0, y1 - y0))
      seg.translate(side * 0.196, (y0 + y1) / 2, (z0 + z1) / 2)
      b.add('head', seg, C.toc)
    }
    const tip = new ConeGeometry(0.024, 0.075, 5)
    tip.rotateX(Math.PI)
    tip.translate(side * 0.196, -0.196, 0.052)
    b.add('head', tip, C.toc)
  }
}

/**
 * Đuôi ngựa dài — dấu nhận dạng ở đường bao.
 *
 * Bản thiết kế ghi thẳng "Facetted Ponytail Structure", và đó là lý do nó là
 * một CHUỖI ĐỐT chứ không một khối uốn cong: mặt cắt giữa hai đốt bắt sáng khác
 * nhau, nên cái đuôi có nhịp sáng-tối chạy dọc thay vì một mảng đen liền.
 *
 * Tiết diện 6 cạnh và ép dẹt theo trục X (0,82): tóc buộc lại thì bẹt theo bề
 * ngang, và ở góc nhìn ba phần tư cái bẹt đó là thứ cho đuôi một hướng.
 */
function buildPonytail(b: RigBuilder<ChibiJoint>): void {
  // Khối gáy — chỗ tóc gom lại trước khi buộc. Không có nó thì đuôi mọc thẳng
  // từ mặt cầu và đọc ra là một cái sừng cắm sau đầu.
  const nape = new SphereGeometry(0.105, 12, 9)
  nape.scale(0.94, 0.86, 0.78)
  nape.translate(0, 0.335, -0.175)
  b.add('head', nape, C.toc)

  const SEGS: ReadonlyArray<readonly [number, number, number]> = [
    // [y, z, bán kính] — cong ra sau rồi hơi thu lại ở cuối
    [0.3, -0.222, 0.082],
    [0.215, -0.256, 0.079],
    [0.115, -0.284, 0.072],
    [0.005, -0.302, 0.062],
    [-0.105, -0.311, 0.05],
    [-0.215, -0.31, 0.037],
    [-0.315, -0.3, 0.024],
  ]
  for (let i = 0; i < SEGS.length - 1; i++) {
    const [y0, z0, r0] = SEGS[i] as readonly [number, number, number]
    const [y1, z1, r1] = SEGS[i + 1] as readonly [number, number, number]
    const len = Math.hypot(y1 - y0, z1 - z0)
    const seg = new CylinderGeometry(r1, r0, len * 1.07, 6)
    seg.scale(0.82, 1, 1)
    seg.rotateX(Math.atan2(z1 - z0, y1 - y0))
    seg.translate(0, (y0 + y1) / 2, (z0 + z1) / 2)
    b.add('head', seg, i % 2 === 0 ? C.toc : C.tocSang)
  }

  const tip = new ConeGeometry(0.024, 0.09, 6)
  tip.rotateX(Math.PI)
  tip.rotateX(-0.1)
  tip.translate(0, -0.355, -0.296)
  b.add('head', tip, C.toc)

  // Vòng kim buộc tóc — vật duy nhất trên đầu không cùng màu tóc, nên mắt bắt
  // được nó ngay và nó đánh dấu đúng chỗ đuôi bắt đầu
  const ring = new CylinderGeometry(0.062, 0.062, 0.038, 10)
  ring.scale(0.85, 1, 1)
  ring.rotateX(Math.PI / 2 - 0.32)
  ring.translate(0, 0.294, -0.219)
  b.add('head', ring, C.kim)
}

/** Mắt, chân mày, sống mũi, miệng. */
function buildFace(b: RigBuilder<ChibiJoint>): void {
  for (const side of [-1, 1]) {
    // Tròng mắt: cầu ép DẸT theo Z để nó "vẽ trên mặt" chứ không lồi ra
    const eye = new SphereGeometry(0.047, 10, 8)
    eye.scale(1.02, 1.24, 0.3)
    eye.translate(side * 0.079, 0.202, 0.233)
    b.add('head', eye, C.mat)

    // Điểm sáng trong mắt — chi tiết nhỏ nhất còn đáng, vì đây chính là thứ
    // biến "khối cầu có hai vết đen" thành "mặt có ánh nhìn"
    const glint = new SphereGeometry(0.016, 6, 5)
    glint.scale(1, 1, 0.6)
    glint.translate(side * 0.09, 0.224, 0.248)
    b.add('head', glint, C.sangMat)

    // Điểm sáng thứ hai, nhỏ hơn và ở góc đối diện — một điểm sáng đọc ra là
    // "mắt thuỷ tinh", hai điểm lệch nhau đọc ra là mắt ướt
    const glint2 = new SphereGeometry(0.008, 5, 4)
    glint2.scale(1, 1, 0.6)
    glint2.translate(side * 0.066, 0.186, 0.246)
    b.add('head', glint2, C.sangMat)

    // Chân mày chếch vào giữa — cho vẻ cương nghị, và nó cũng là thứ duy nhất
    // trên mặt nói được biểu cảm ở khoảng cách camera iso
    const brow = new BoxGeometry(0.068, 0.017, 0.022)
    brow.rotateZ(side * -0.2)
    brow.translate(side * 0.081, 0.256, 0.239)
    b.add('head', brow, C.toc)
  }

  // Sống mũi: một nêm rất nhỏ. Nó gần như vô hình ở xa, nhưng ở Đồ Giám — chỗ
  // mô hình đứng một mình trên bệ xoay — thiếu nó thì mặt phẳng lì.
  const nose = new ConeGeometry(0.016, 0.03, 4)
  nose.rotateX(Math.PI / 2)
  nose.scale(1, 1.3, 1)
  nose.translate(0, 0.176, 0.246)
  b.add('head', nose, C.daToi)

  const mouth = new BoxGeometry(0.04, 0.013, 0.018)
  mouth.translate(0, 0.132, 0.243)
  b.add('head', mouth, C.moi)
}

// ───────────────────────────────── Thân ─────────────────────────────────

/**
 * Thân: đạo bào trắng, giao lĩnh có lớp lót lam, đai lưng thắt nút.
 *
 * Giao lĩnh (áo vạt chéo) là thứ nói "tu tiên" mạnh nhất trên trang phục, và nó
 * chỉ đọc được khi có HAI LỚP: vạt ngoài trắng đè lên vạt trong lam, giao nhau
 * thành chữ V trước ngực. Một cổ áo một lớp thì ra áo choàng tắm.
 */
function buildTorso(b: RigBuilder<ChibiJoint>): void {
  const chest = new CylinderGeometry(0.134, 0.121, 0.28, 14)
  chest.translate(0, 0.14, 0)
  b.add('torso', chest, C.bao)

  // Lớp lót lam lộ ra ở chữ V trước ngực
  const inner = new CylinderGeometry(0.128, 0.117, 0.2, 14, 1, false, -0.75, 1.5)
  inner.translate(0, 0.185, 0.004)
  b.add('torso', inner, C.lam)

  // Hai vạt áo ngoài giao nhau. Vạt PHẢI đè lên vạt trái — bên trái đè phải là
  // lối mặc cho người chết, một chi tiết nhỏ mà người đọc truyện nhận ra ngay.
  for (const side of [1, -1]) {
    const lapel = new BoxGeometry(0.115, 0.2, 0.036)
    lapel.rotateZ(side * 0.62)
    lapel.translate(side * 0.045, 0.198, 0.112 + (side > 0 ? 0.008 : 0))
    b.add('torso', lapel, side > 0 ? C.bao : C.baoDam)

    // Viền lam chạy dọc mép vạt
    const edge = new BoxGeometry(0.03, 0.205, 0.022)
    edge.rotateZ(side * 0.62)
    edge.translate(side * 0.088, 0.19, 0.128 + (side > 0 ? 0.008 : 0))
    b.add('torso', edge, C.lam)
  }

  // Cổ áo dựng — vành quanh gáy, cao hơn ở phía sau
  const collar = new CylinderGeometry(0.104, 0.138, 0.056, 14)
  collar.translate(0, 0.272, 0)
  b.add('torso', collar, C.bao)
  const collarBack = new CylinderGeometry(0.107, 0.118, 0.055, 14, 1, false, Math.PI - 0.9, 1.8)
  collarBack.translate(0, 0.3, 0)
  b.add('torso', collarBack, C.lam)

  // Yếm vai: mảng lam vắt qua hai vai, thứ chia đôi khối thân theo chiều dọc.
  // Không có nó thì thân là một hình trụ trắng cao 0,28 không có gì để nhìn.
  const yoke = new CylinderGeometry(0.139, 0.133, 0.07, 14)
  yoke.translate(0, 0.238, 0)
  b.add('torso', yoke, C.lam)

  buildSash(b)
}

/** Đai lưng: vành, nút thắt, và hai dải buông trước. */
function buildSash(b: RigBuilder<ChibiJoint>): void {
  const belt = new CylinderGeometry(0.129, 0.129, 0.062, 14)
  belt.translate(0, 0.008, 0)
  b.add('torso', belt, C.dai)

  const trim = new CylinderGeometry(0.131, 0.131, 0.014, 14)
  trim.translate(0, 0.036, 0)
  b.add('torso', trim, C.lam)

  // Nút thắt lệch sang trái — đặt chính giữa thì nó trùng trục đối xứng của cả
  // nhân vật và biến mất vào đường giữa
  const knot = new SphereGeometry(0.046, 10, 8)
  knot.scale(1.25, 0.9, 0.8)
  knot.translate(0.052, 0.006, 0.116)
  b.add('torso', knot, C.dai)

  // Hai dải buông, dài ngắn khác nhau — bằng nhau thì đọc ra là hai cái que
  for (const [x, len, tilt] of [
    [0.03, 0.19, 0.1],
    [0.078, 0.13, -0.08],
  ] as ReadonlyArray<readonly [number, number, number]>) {
    const ribbon = new BoxGeometry(0.036, len, 0.016)
    ribbon.rotateZ(tilt)
    ribbon.translate(x, -0.03 - len / 2, 0.122)
    b.add('torso', ribbon, C.dai)
    const tip = new BoxGeometry(0.038, 0.022, 0.017)
    tip.rotateZ(tilt)
    tip.translate(x - Math.sin(tilt) * len, -0.036 - len, 0.122)
    b.add('torso', tip, C.lam)
  }
}

/**
 * Vạt dưới: loe ra và dừng ngang đầu gối.
 *
 * Dừng ở gối chứ không dài tới đất — áo dài chấm đất làm cả chu kỳ đi và chạy
 * trở nên vô hình, mà chu kỳ chân là thứ duy nhất nói lên nhân vật đang di
 * chuyển nhanh hay chậm.
 */
function buildSkirt(b: RigBuilder<ChibiJoint>): void {
  const skirt = new CylinderGeometry(0.126, 0.206, 0.176, 16)
  skirt.translate(0, -0.076, 0)
  b.add('hip', skirt, C.bao)

  // Nếp gấp: sáu dải mảnh chạy dọc, tối hơn thân vạt. Đây là chỗ cho phép nhiều
  // tam giác trả lại nhiều nhất — một hình nón cụt trơn ở cỡ này trông như nhựa.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6
    const pleat = new BoxGeometry(0.026, 0.17, 0.03)
    pleat.rotateY(-a)
    pleat.translate(Math.sin(a) * 0.172, -0.078, Math.cos(a) * 0.172)
    b.add('hip', pleat, C.baoDam)
  }

  // Vạt trước xẻ đôi, hai tà chồng nhau — cùng lối giao lĩnh với thân trên
  for (const side of [1, -1]) {
    const flap = new BoxGeometry(0.13, 0.2, 0.026)
    flap.rotateZ(side * 0.06)
    flap.translate(side * 0.052, -0.082, 0.166 + (side > 0 ? 0.01 : 0))
    b.add('hip', flap, side > 0 ? C.bao : C.baoDam)
  }

  const hem = new CylinderGeometry(0.207, 0.213, 0.034, 16)
  hem.translate(0, -0.161, 0)
  b.add('hip', hem, C.lam)
}

// ───────────────────────────── Chân và tay ─────────────────────────────

function buildLegs(b: RigBuilder<ChibiJoint>): void {
  for (const [hipJoint, kneeJoint] of [
    ['hipL', 'kneeL'],
    ['hipR', 'kneeR'],
  ] as Array<[ChibiJoint, ChibiJoint]>) {
    const thigh = new CylinderGeometry(0.055, 0.048, 0.17, 8)
    thigh.translate(0, -0.085, 0)
    b.add(hipJoint, thigh, C.bao)

    const shin = new CylinderGeometry(0.047, 0.043, 0.112, 8)
    shin.translate(0, -0.056, 0)
    b.add(kneeJoint, shin, C.bao)

    // Xà cạp quấn cổ chân — chi tiết trang phục tu sĩ, và nó cũng cắt đôi ống
    // quần nên chân không còn là một cái ống trắng dài
    const wrap = new CylinderGeometry(0.05, 0.046, 0.036, 8)
    wrap.translate(0, -0.096, 0)
    b.add(kneeJoint, wrap, C.lam)

    // Hài: đế bẹt, mũi hơi hếch lên
    const shoe = new BoxGeometry(0.088, 0.05, 0.12)
    shoe.translate(0, -0.13, 0.016)
    b.add(kneeJoint, shoe, C.hia)
    const toe = new BoxGeometry(0.082, 0.036, 0.036)
    toe.rotateX(-0.35)
    toe.translate(0, -0.122, 0.079)
    b.add(kneeJoint, toe, C.hia)
    const sole = new BoxGeometry(0.092, 0.016, 0.126)
    sole.translate(0, -0.152, 0.018)
    b.add(kneeJoint, sole, C.lamDam)
  }
}

/**
 * Tay: ống tay LOE mạnh, cổ tay viền lam, bàn tay là một khối đơn giản.
 *
 * Bàn tay để đơn giản là CỐ Ý, đúng như bản thiết kế ghi ("Simplified Hand
 * Geometry"): ngón tay ở tỉ lệ chibi nhỏ hơn một pixel ở khoảng cách chơi, nên
 * chúng chỉ làm bàn tay thành một đám nhiễu. Một khối liền giữ được đường bao
 * sạch, và đó là thứ duy nhất bàn tay cần làm.
 */
function buildArms(b: RigBuilder<ChibiJoint>): void {
  for (const [shoulderJoint, elbowJoint] of [
    ['shoulderL', 'elbowL'],
    ['shoulderR', 'elbowR'],
  ] as Array<[ChibiJoint, ChibiJoint]>) {
    const upper = new CylinderGeometry(0.045, 0.041, 0.172, 8)
    upper.translate(0, -0.086, 0)
    b.add(shoulderJoint, upper, C.bao)

    // Ống tay loe — dấu hiệu nhận biết rõ nhất của trang phục tu tiên, nên nó
    // loe mạnh hơn hẳn bản dùng chung (0,041 → 0,072 thay vì 0,046 → 0,058)
    const sleeve = new CylinderGeometry(0.048, 0.072, 0.138, 10)
    sleeve.translate(0, -0.062, 0)
    b.add(elbowJoint, sleeve, C.bao)

    // Nếp trong ống tay
    const fold = new CylinderGeometry(0.05, 0.068, 0.03, 10)
    fold.translate(0, -0.096, 0)
    b.add(elbowJoint, fold, C.baoDam)

    const cuff = new CylinderGeometry(0.072, 0.076, 0.03, 10)
    cuff.translate(0, -0.134, 0)
    b.add(elbowJoint, cuff, C.lam)
  }

  for (const handJoint of ['handL', 'handR'] as ChibiJoint[]) {
    const hand = new SphereGeometry(0.045, 8, 6)
    hand.scale(1, 0.9, 1.05)
    b.add(handJoint, hand, C.da)
  }
}
