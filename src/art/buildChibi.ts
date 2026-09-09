import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  SphereGeometry,
  type Bone,
  type SkinnedMesh,
} from 'three'
import { Animator } from '@/anim/Clip'
import { materials } from '@/render/Materials'
import { ChibiBuilder, type JointName } from './ChibiRig'

export interface ChibiColors {
  /** Áo ngoài / tay áo. */
  robe: number
  /** Vạt dưới, ống quần — tông đậm hơn để tách khối. */
  robeDark: number
  /** Viền cổ, viền tay, gấu áo. */
  trim: number
  /** Đai lưng. */
  sash: number
  skin: number
  hair: number
  boot: number
  eye?: number
}

export interface ChibiParams extends ChibiColors {
  name: string
  /** 1 = cao ~1.1 world unit. Quái nhỏ dùng 0.8, tướng dùng 1.25. */
  height?: number
  /**
   * 'full' — nhân vật có tên, có mắt sáng và viền áo chi tiết.
   * 'simple' — quái thường: bớt chi tiết mặt và viền, ít tam giác hơn.
   */
  detail?: 'full' | 'simple'
}

export interface Chibi {
  /** Node đặt vào thế giới. Xoay node này để nhân vật quay mặt. */
  root: Group
  mesh: SkinnedMesh
  bones: Record<JointName, Bone>
  animator: Animator
  /** Chiều cao thực tế sau khi nhân tỉ lệ, dùng cho HP bar và ngắm chiêu. */
  height: number
}

/** Bán kính va chạm mặc định theo tỉ lệ nhân vật. */
export function chibiRadius(height = 1): number {
  return 0.26 * height
}

/**
 * Dựng một nhân vật chibi.
 *
 * Tỉ lệ là thứ quyết định "cute": đầu chiếm ~42% chiều cao (người thật ~13%),
 * chi ngắn và mập, mắt to đặt thấp trên khuôn mặt. Ở khoảng cách camera iso
 * những tỉ lệ này đọc ra ngay, còn chi tiết nhỏ thì không — nên chi tiết được
 * dồn vào silhouette (tay áo loe, vạt áo, tóc buộc) chứ không vào bề mặt.
 */
export function buildChibi(params: ChibiParams): Chibi {
  const detail = params.detail ?? 'full'
  const full = detail === 'full'
  const eyeColor = params.eye ?? 0x1b1b22
  const b = new ChibiBuilder()

  // ---------- Đầu ----------
  // Cầu 7x5 mặt: đủ tròn để trông mềm, đủ ít mặt để thấy rõ các facet
  const head = new SphereGeometry(0.235, 7, 5)
  head.scale(1, 0.98, 0.94)
  head.translate(0, 0.225, 0)
  b.add('head', head, params.skin)

  // Tóc là một vòm KÍN, còn khuôn mặt được "khoét" ra bằng một tấm mặt có bán
  // kính LỚN HƠN tóc nên nó nằm phía ngoài và thắng z-test.
  //
  // Hai cách trước đều thất bại và lý do đáng ghi lại:
  //  - Một mũ cầu phủ kín phía sau thì cũng trùm qua mắt ở phía trước.
  //  - Hai nửa cầu trước/sau với thetaLength khác nhau thì không khớp mép ở thái
  //    dương, tạo ra bậc; mà cắt thetaLength ngắn lại thì đỉnh đầu bị phẳng.
  // Vòm kín + tấm mặt tránh được cả hai: silhouette liền mạch, và ranh giới trên
  // của tấm mặt chính là ĐƯỜNG CHÂN TÓC, một chi tiết muốn có chứ không phải lỗi.
  const hair = new SphereGeometry(0.248, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.62)
  hair.scale(1, 1.02, 1)
  hair.translate(0, 0.222, 0)
  b.add('head', hair, params.hair)

  // Tấm mặt: chỉ nửa trước (phi 0..PI cho z > 0), từ chân tóc xuống hết má
  const face = new SphereGeometry(0.253, 8, 5, 0, Math.PI, Math.PI * 0.46, Math.PI * 0.34)
  face.translate(0, 0.222, 0)
  b.add('head', face, params.skin)

  // Mắt: dẹt theo trục Z để ốp vào mặt cầu, cao theo trục Y -> mắt "to tròn"
  for (const side of [-1, 1]) {
    const eye = new SphereGeometry(0.045, 6, 4)
    // Dẹt mạnh theo Z: mắt phải "vẽ trên mặt" chứ không lồi ra như quả cầu.
    // Vị trí nằm trên mặt cầu bán kính 0.247 quanh tâm đầu, hơi chúc xuống —
    // đủ để mặt ngoài của mắt vượt ra ngoài tấm mặt (0.253) và hiện lên.
    eye.scale(1.05, 1.22, 0.32)
    eye.translate(side * 0.078, 0.203, 0.233)
    b.add('head', eye, eyeColor)

    if (full) {
      // Điểm sáng trong mắt — chi tiết duy nhất nhỏ như vậy mà vẫn đáng, vì đây
      // chính là thứ biến "khối cầu có 2 vết đen" thành "mặt có biểu cảm"
      const glint = new SphereGeometry(0.015, 4, 3)
      glint.scale(1, 1, 0.6)
      glint.translate(side * 0.088, 0.224, 0.247)
      b.add('head', glint, 0xf2f6ff)

      // Chân mày: hơi chếch vào giữa cho vẻ cương nghị
      const brow = new BoxGeometry(0.062, 0.016, 0.02)
      brow.rotateZ(side * -0.16)
      brow.translate(side * 0.079, 0.253, 0.238)
      b.add('head', brow, params.hair)
    }
  }

  if (full) {
    const mouth = new BoxGeometry(0.038, 0.013, 0.018)
    mouth.translate(0, 0.135, 0.243)
    b.add('head', mouth, 0x6b4038)
  }

  // ---------- Thân ----------
  const chest = new CylinderGeometry(0.131, 0.119, 0.28, 7)
  chest.translate(0, 0.14, 0)
  b.add('torso', chest, params.robe)

  const collar = new CylinderGeometry(0.101, 0.137, 0.052, 7)
  collar.translate(0, 0.272, 0)
  b.add('torso', collar, params.trim)

  if (full) {
    // Vạt áo chéo trước ngực — gợi áo giao lĩnh
    const lapel = new BoxGeometry(0.05, 0.14, 0.02)
    lapel.rotateZ(0.34)
    lapel.translate(0.034, 0.196, 0.117)
    b.add('torso', lapel, params.trim)
  }

  const sash = new CylinderGeometry(0.126, 0.126, 0.058, 7)
  sash.translate(0, 0.008, 0)
  b.add('torso', sash, params.sash)

  // ---------- Vạt dưới ----------
  // Loe ra và dừng ở ngang đầu gối: đủ để đọc ra áo tu sĩ, mà vẫn thấy được
  // chân chuyển động (áo dài tới đất sẽ làm chu kỳ đi/chạy vô hình)
  const skirt = new CylinderGeometry(0.124, 0.202, 0.172, 8)
  skirt.translate(0, -0.076, 0)
  b.add('hip', skirt, params.robeDark)

  const hem = new CylinderGeometry(0.202, 0.208, 0.03, 8)
  hem.translate(0, -0.158, 0)
  b.add('hip', hem, params.trim)

  // ---------- Chân ----------
  for (const [hipJoint, kneeJoint] of [
    ['hipL', 'kneeL'],
    ['hipR', 'kneeR'],
  ] as Array<[JointName, JointName]>) {
    const thigh = new CylinderGeometry(0.053, 0.047, 0.17, 5)
    thigh.translate(0, -0.085, 0)
    b.add(hipJoint, thigh, params.robeDark)

    const shin = new CylinderGeometry(0.046, 0.042, 0.112, 5)
    shin.translate(0, -0.056, 0)
    b.add(kneeJoint, shin, params.robeDark)

    const boot = new BoxGeometry(0.086, 0.052, 0.118)
    boot.translate(0, -0.128, 0.016)
    b.add(kneeJoint, boot, params.boot)
  }

  // ---------- Tay ----------
  for (const [shoulderJoint, elbowJoint] of [
    ['shoulderL', 'elbowL'],
    ['shoulderR', 'elbowR'],
  ] as Array<[JointName, JointName]>) {
    const upperArm = new CylinderGeometry(0.043, 0.039, 0.172, 5)
    upperArm.translate(0, -0.086, 0)
    b.add(shoulderJoint, upperArm, params.robe)

    // Tay áo LOE ra ở cẳng tay — dấu hiệu nhận biết rõ nhất của trang phục tu tiên
    const sleeve = new CylinderGeometry(0.046, 0.058, 0.132, 5)
    sleeve.translate(0, -0.062, 0)
    b.add(elbowJoint, sleeve, params.robe)

    const cuff = new CylinderGeometry(0.058, 0.062, 0.026, 5)
    cuff.translate(0, -0.132, 0)
    b.add(elbowJoint, cuff, params.trim)

    const hand = new SphereGeometry(0.043, 5, 3)
    hand.scale(1, 0.9, 1.05)
    hand.translate(0, -0.163, 0)
    b.add(elbowJoint, hand, params.skin)
  }

  const material = materials.flat(0xffffff, { vertexColors: true })
  const { mesh, skeleton } = b.finish(material, params.name)

  const height = params.height ?? 1
  mesh.scale.setScalar(height)

  const root = new Group()
  root.name = `${params.name}:root`
  root.add(mesh)

  return {
    root,
    mesh,
    bones: skeleton.bones,
    animator: new Animator(skeleton.bones),
    height: 1.1 * height,
  }
}
