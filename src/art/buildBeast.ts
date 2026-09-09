import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, SphereGeometry, type Bone } from 'three'
import { Animator } from '@/anim/Clip'
import { RigBuilder } from '@/anim/Rig'
import { materials } from '@/render/Materials'
import { BEAST_RIG, type BeastJoint } from './BeastRig'

export type BeastShape = 'wolf' | 'rat'

export interface BeastParams {
  name: string
  shape: BeastShape
  /** 1 = dài ~1.0, cao vai ~0.42. Yêu Thử dùng ~0.52, Hắc Lang ~1.05. */
  height?: number
  fur: number
  furDark: number
  belly: number
  eye: number
  nose: number
  detail?: 'full' | 'simple'
}

export interface Beast {
  root: Group
  bones: Record<BeastJoint, Bone>
  animator: Animator<BeastJoint>
  /** Chiều cao vai sau khi nhân tỉ lệ — dùng cho HP bar và ngắm chiêu. */
  height: number
}

/** Cặp chân trước/sau, dùng để lặp khi dựng cả bốn chân. */
const LEGS: ReadonlyArray<readonly [BeastJoint, BeastJoint, boolean]> = [
  ['legFL', 'pawFL', true],
  ['legFR', 'pawFR', true],
  ['legBL', 'pawBL', false],
  ['legBR', 'pawBR', false],
]

/**
 * Dựng một con thú bốn chân.
 *
 * Dùng CÙNG mã Clip/Animator/skinning với người chibi, chỉ khác bảng khớp —
 * đó là lý do hệ rig được tổng quát hoá thành `RigDef`.
 *
 * Chi tiết được dồn vào SILHOUETTE (mõm dài, tai dựng, đuôi, gờ lông sống lưng)
 * chứ không vào bề mặt, vì ở khoảng cách camera iso chỉ silhouette là đọc được.
 */
export function buildBeast(params: BeastParams): Beast {
  const b = new RigBuilder(BEAST_RIG)
  const wolf = params.shape === 'wolf'
  const full = (params.detail ?? 'full') === 'full'

  // ---------- Thân ----------
  // Ngực to hơn phần sau: dáng thú săn, và giúp phân biệt đầu/đuôi từ trên xuống
  const chest = new BoxGeometry(wolf ? 0.28 : 0.3, wolf ? 0.29 : 0.31, wolf ? 0.34 : 0.28)
  chest.translate(0, 0.01, wolf ? 0.14 : 0.1)
  b.add('spine', chest, params.fur)

  const rear = new BoxGeometry(wolf ? 0.24 : 0.29, wolf ? 0.25 : 0.29, wolf ? 0.34 : 0.3)
  rear.translate(0, -0.01, wolf ? -0.16 : -0.14)
  b.add('spine', rear, params.fur)

  const bellyGeo = new BoxGeometry(wolf ? 0.2 : 0.24, 0.1, wolf ? 0.5 : 0.42)
  bellyGeo.translate(0, -0.12, 0)
  b.add('spine', bellyGeo, params.belly)

  if (full) {
    // Gờ lông sống lưng — nét silhouette làm con thú trông dữ
    const ridge = new BoxGeometry(0.09, wolf ? 0.09 : 0.05, wolf ? 0.52 : 0.4)
    ridge.translate(0, wolf ? 0.16 : 0.15, 0)
    b.add('spine', ridge, params.furDark)
  }

  // ---------- Cổ và đầu ----------
  const neck = new CylinderGeometry(0.1, wolf ? 0.13 : 0.12, 0.17, 6)
  neck.translate(0, 0.06, 0)
  b.add('neck', neck, params.fur)

  const skull = new BoxGeometry(wolf ? 0.19 : 0.2, wolf ? 0.17 : 0.18, wolf ? 0.2 : 0.18)
  skull.translate(0, 0.02, 0.04)
  b.add('head', skull, params.fur)

  // Mõm: dài và nhọn ở sói, ngắn và tròn ở chuột
  const snout = new BoxGeometry(wolf ? 0.1 : 0.11, wolf ? 0.09 : 0.08, wolf ? 0.17 : 0.1)
  snout.translate(0, wolf ? -0.03 : -0.04, wolf ? 0.2 : 0.16)
  b.add('head', snout, wolf ? params.fur : params.belly)

  const nose = new BoxGeometry(0.045, 0.035, 0.03)
  nose.translate(0, wolf ? -0.025 : -0.035, wolf ? 0.29 : 0.215)
  b.add('head', nose, params.nose)

  for (const side of [-1, 1]) {
    if (wolf) {
      // Tai nhọn dựng đứng
      const ear = new ConeGeometry(0.05, 0.12, 4)
      ear.rotateX(-0.12)
      ear.translate(side * 0.07, 0.15, -0.01)
      b.add('head', ear, params.furDark)
    } else {
      // Tai đĩa to — dấu hiệu nhận biết rõ nhất của loài chuột
      const ear = new CylinderGeometry(0.085, 0.085, 0.018, 7)
      ear.rotateZ(side * -0.32)
      ear.rotateX(-0.1)
      ear.translate(side * 0.1, 0.15, -0.01)
      b.add('head', ear, params.belly)
    }

    // Mắt sáng: dùng màu vertex rực chứ không dùng material glow, vì glow phải
    // là mesh riêng và quái là thứ đông nhất trên màn — không đáng gấp đôi draw call
    const eye = new SphereGeometry(wolf ? 0.026 : 0.03, 5, 4)
    eye.scale(1, 1, 0.6)
    eye.translate(side * (wolf ? 0.062 : 0.068), wolf ? 0.045 : 0.035, wolf ? 0.135 : 0.105)
    b.add('head', eye, params.eye)
  }

  // ---------- Đuôi ----------
  const tail = wolf
    ? new CylinderGeometry(0.055, 0.028, 0.36, 5)
    : new CylinderGeometry(0.022, 0.012, 0.46, 4)
  tail.translate(0, wolf ? -0.16 : -0.21, 0)
  b.add('tail', tail, wolf ? params.furDark : params.belly)

  // ---------- Bốn chân ----------
  for (const [legJoint, pawJoint, isFront] of LEGS) {
    const thickness = isFront ? 0.056 : 0.06
    const upper = new CylinderGeometry(thickness, thickness * 0.82, 0.2, 5)
    upper.translate(0, -0.1, 0)
    b.add(legJoint, upper, params.fur)

    const lower = new CylinderGeometry(0.042, 0.038, 0.13, 5)
    lower.translate(0, -0.065, 0)
    b.add(pawJoint, lower, params.furDark)

    const paw = new BoxGeometry(0.085, 0.05, 0.11)
    paw.translate(0, -0.145, 0.015)
    b.add(pawJoint, paw, params.furDark)
  }

  const material = materials.flat(0xffffff, { vertexColors: true })
  const { mesh, skeleton } = b.finish(material, params.name)

  const scale = params.height ?? 1
  mesh.scale.setScalar(scale)

  const root = new Group()
  root.name = `${params.name}:root`
  root.add(mesh)

  return {
    root,
    bones: skeleton.bones,
    animator: new Animator(BEAST_RIG, skeleton.bones),
    // 0.42 là cao độ khớp `spine` trong BEAST_RIG
    height: 0.42 * scale,
  }
}

/** Bán kính va chạm theo tỉ lệ con thú. */
export function beastRadius(scale = 1): number {
  return 0.3 * scale
}
