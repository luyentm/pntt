import { BoxGeometry, ConeGeometry, IcosahedronGeometry, type BufferGeometry } from 'three'
import { at, mergeAll, paint } from '@/art/geo'
import { Palette } from '@/art/Palette'

/** Kiểu tạo hình của phi hành khí. */
export type ProjectileLook = 'kiem' | 'hoaCau' | 'phuLuc'

/**
 * Geometry chuẩn hoá cho phi hành khí, hướng mũi về +Z, dài/rộng khoảng 1 unit.
 * Instance sẽ scale và xoay, nên mỗi loại chỉ cần một geometry.
 */
export function projectileGeometry(look: ProjectileLook): BufferGeometry {
  switch (look) {
    case 'kiem': {
      // Phi kiếm: lưỡi dài mỏng + mũi nhọn + hộ thủ, đủ để đọc ra "thanh kiếm"
      // ở silhouette dù chỉ dài 0.5 unit trên màn hình
      const parts: BufferGeometry[] = []
      const blade = new BoxGeometry(0.1, 0.035, 0.72)
      parts.push(paint(at(blade, 0, 0, 0.06), Palette.daNhat))

      const tip = new ConeGeometry(0.055, 0.2, 4)
      tip.rotateX(Math.PI / 2)
      parts.push(paint(at(tip, 0, 0, 0.52), Palette.daNhat))

      const guard = new BoxGeometry(0.2, 0.045, 0.05)
      parts.push(paint(at(guard, 0, 0, -0.31), Palette.kim))

      const grip = new BoxGeometry(0.05, 0.05, 0.16)
      parts.push(paint(at(grip, 0, 0, -0.41), Palette.than))
      return mergeAll(parts)
    }
    case 'hoaCau': {
      // Khối đa diện có mặt cắt, KHÔNG dùng cầu trơn: cả game là lowpoly nên
      // quả cầu lửa cũng phải có facet mới cùng chất
      const geo = new IcosahedronGeometry(0.5, 0)
      return paint(geo, Palette.hoa)
    }
    default: {
      // Phù lục: tờ giấy vàng có dải chữ đỏ
      const parts: BufferGeometry[] = []
      const paper = new BoxGeometry(0.44, 0.03, 0.72)
      parts.push(paint(paper, Palette.vang))
      const glyph = new BoxGeometry(0.1, 0.045, 0.52)
      parts.push(paint(at(glyph, 0, 0.005, 0), Palette.maHuyet))
      return mergeAll(parts)
    }
  }
}
