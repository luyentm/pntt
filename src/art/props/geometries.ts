import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  type BufferGeometry,
} from 'three'
import { at, mergeAll, paint, spinY } from '@/art/geo'
import { Palette } from '@/art/Palette'

/**
 * Geometry CHUẨN HOÁ cho prop được instance.
 *
 * Quy ước: chân ở y = 0, chiều cao (hoặc bán kính) bằng 1. Nhờ vậy PropBatch chỉ
 * cần đặt scale là ra đúng kích thước, và mọi bản dùng chung một geometry duy nhất.
 *
 * Biến thể (`variant`) là cách bù cho việc instance không đổi được hình dáng:
 * vài geometry khác nhau, mỗi cái một batch — 3 batch cho 90 cây vẫn chỉ 3 draw call.
 */

/** Cây tùng, cao 1. */
export function pineGeometry(variant: number): BufferGeometry {
  const tiers = [3, 4, 3][variant % 3] as number
  const spread = [0.32, 0.28, 0.36][variant % 3] as number
  const trunkH = [0.3, 0.24, 0.34][variant % 3] as number

  const parts: BufferGeometry[] = []
  const trunk = new CylinderGeometry(0.042, 0.068, trunkH, 5)
  parts.push(paint(at(trunk, 0, trunkH * 0.5, 0), Palette.than))

  for (let i = 0; i < tiers; i++) {
    const t = tiers === 1 ? 0 : i / (tiers - 1)
    const r = spread * (1 - t * 0.52)
    const h = 0.34 - t * 0.08
    const y = trunkH + 0.1 + t * (0.86 - trunkH) * 0.78
    const cone = new ConeGeometry(r, h, 6)
    // Lệch góc từng tầng để tán không xếp thẳng hàng thành một khối
    spinY(cone, (i * Math.PI) / 5)
    parts.push(paint(at(cone, 0, y, 0), i === tiers - 1 ? Palette.laTungNhat : Palette.laTung))
  }
  return mergeAll(parts)
}

/** Tảng đá, bán kính 1, đã dìm một phần xuống dưới y = 0 để trông như mọc lên. */
export function rockGeometry(variant: number): BufferGeometry {
  const squash = [0.62, 0.78, 0.5][variant % 3] as number
  const stretch = [1, 0.85, 1.2][variant % 3] as number

  const geo = new DodecahedronGeometry(1, 0)
  geo.scale(stretch, squash, 2 - stretch)
  spinY(geo, (variant * Math.PI) / 4)
  // Dìm xuống 30% để không có khe hở giữa đá và mặt đất gợn
  geo.translate(0, squash * 0.7, 0)
  return paint(geo, variant === 1 ? Palette.daDam : Palette.da)
}

/**
 * Bụi tre, cao 1. Tre là prop đáng đầu tư nhất của map này: nó là cảnh đặc trưng
 * của sơn môn tu tiên, và cũng là vật liệu của Thanh Trúc Phong Vân Kiếm sau này.
 */
export function bambooGeometry(variant: number): BufferGeometry {
  const stalks = [4, 3, 5][variant % 3] as number
  const parts: BufferGeometry[] = []

  for (let i = 0; i < stalks; i++) {
    const a = (i / stalks) * Math.PI * 2 + variant
    const dist = 0.045 + (i % 2) * 0.035
    const sx = Math.cos(a) * dist
    const sz = Math.sin(a) * dist
    const h = 0.78 + (i % 3) * 0.11
    const lean = 0.035

    const stalk = new CylinderGeometry(0.017, 0.022, h, 5)
    stalk.rotateZ(Math.cos(a) * lean)
    stalk.rotateX(-Math.sin(a) * lean)
    parts.push(paint(at(stalk, sx, h * 0.5, sz), Palette.tre))

    // Đốt tre: một khoanh nhạt hơn, đủ để đọc ra "tre" chứ không phải "que".
    // Trước dùng 2 đốt và 3 lá mỗi thân -> khóm tre một mình ngốn 42k tam giác,
    // mà ở khoảng cách nhìn thấy khóm tre thì chi tiết đó không đọc được.
    for (let k = 1; k <= 1; k++) {
      const y = (h * k) / 2
      const node = new CylinderGeometry(0.024, 0.024, 0.016, 5)
      parts.push(paint(at(node, sx, y, sz), Palette.laTungNhat))
    }

    // Lá: khối hộp mỏng thay vì mặt phẳng, để dùng chung material một mặt
    for (let k = 0; k < 2; k++) {
      const la = (a + k * 2.3) % (Math.PI * 2)
      const leaf = new BoxGeometry(0.13, 0.012, 0.035)
      leaf.rotateZ(0.3)
      leaf.rotateY(la)
      parts.push(
        paint(
          at(leaf, sx + Math.cos(la) * 0.06, h - 0.04 - k * 0.07, sz + Math.sin(la) * 0.06),
          k === 0 ? Palette.laTungNhat : Palette.moc,
        ),
      )
    }
  }
  return mergeAll(parts)
}
