/**
 * Độ cao mặt đất của đấu trường.
 *
 * NGUỒN DUY NHẤT: cả mesh địa hình và bàn chân nhân vật đều gọi hàm này. Nếu hai
 * bên tính bằng hai công thức riêng thì nhân vật sẽ lún xuống đất hoặc lơ lửng —
 * loại lỗi rất khó nhìn ra vì lệch chỉ vài centimet.
 */

/** Bán kính vùng phẳng ở giữa — đài đá và khu chiến đấu chính. */
export const ARENA_FLAT_RADIUS = 12
/** Ra ngoài bán kính này thì địa hình gợn hết biên độ. */
export const ARENA_ROLL_RADIUS = 30

export function arenaGroundHeight(x: number, z: number): number {
  const d = Math.hypot(x, z)
  // Vùng giữa phẳng tuyệt đối để đài đá và nhân vật không bị nghiêng,
  // rồi chuyển dần sang gợn đồi ở vòng ngoài
  const t = (d - ARENA_FLAT_RADIUS) / (ARENA_ROLL_RADIUS - ARENA_FLAT_RADIUS)
  const flatten = Math.min(1, Math.max(0, t))
  if (flatten === 0) return 0

  return (
    (Math.sin(x * 0.045) * Math.cos(z * 0.038) * 4.2 +
      Math.sin(x * 0.11 + 1.7) * Math.cos(z * 0.093 - 0.6) * 1.5 +
      Math.sin(x * 0.21 - 0.4) * Math.cos(z * 0.19 + 1.1) * 0.5) *
    flatten
  )
}
