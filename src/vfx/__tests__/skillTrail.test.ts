import { describe, expect, it } from 'vitest'
import { SKILLS } from '@/game/data/skills'
import { SKILL_TRAIL, skillTrail } from '../Vfx'

/** Không phải chiêu trong bảng SKILLS — đòn quét của Mặc Đại Phu. */
const BOSS_ONLY = ['bossSlam']

describe('màu vệt theo chiêu', () => {
  it('mọi id trong bảng là chiêu thật', () => {
    // Đổi tên một chiêu trong `skills.ts` mà quên sửa ở đây thì chiêu đó âm thầm
    // rơi về cặp màu ngũ hành, và không có gì báo — chỉ là "sao chiêu này đổi màu"
    const known = new Set([...SKILLS.map((s) => s.id), ...BOSS_ONLY])
    for (const id of Object.keys(SKILL_TRAIL)) {
      expect(known, `id "${id}" không có trong bảng chiêu`).toContain(id)
    }
  })

  it('chiêu không có cặp riêng thì lấy theo ngũ hành', () => {
    const kim = skillTrail('__khongCoChieuNay__', 'kim')
    expect(skillTrail('nguKiem', 'kim')).toEqual(kim)
  })

  it('Thiên Lôi Phù không bao giờ ra màu kim quang', () => {
    // Nó là hệ `kim`, nên bỏ dòng của nó khỏi bảng là tia sét ra vàng đồng
    const kim = skillTrail('__khongCoChieuNay__', 'kim')
    expect(skillTrail('thienLoiPhu', 'kim')).not.toEqual(kim)
  })

  it('ba chiêu hỗ trợ/độc có cặp màu riêng, không đụng nhau', () => {
    // Ba chiêu mới đều KHÔNG lấy màu theo ngũ hành được: Giá Y và Đại Diễn là
    // `vo` (rơi vào cặp chủ đạo), Thực Kim Trùng là `kim` (ra vàng đồng như
    // Ngự Kiếm). Chúng phải phân biệt được với nhau và với cặp gốc của mình.
    const chuDao = skillTrail('__khongCoChieuNay__', 'vo')
    const kim = skillTrail('__khongCoChieuNay__', 'kim')
    const giaY = skillTrail('giaYThanCong', 'vo')
    const daiDien = skillTrail('daiDienQuyet', 'vo')
    const trung = skillTrail('thucKimTrung', 'kim')

    for (const [ten, cap, goc] of [
      ['Giá Y Thần Công', giaY, chuDao],
      ['Đại Diễn Quyết', daiDien, chuDao],
      ['Thực Kim Trùng', trung, kim],
    ] as const) {
      expect(cap, `${ten} rơi về cặp mặc định`).not.toEqual(goc)
    }
    expect(new Set([giaY, daiDien, trung].map((c) => `${c.head}-${c.tail}`)).size).toBe(3)
  })

  it('★ chiêu chiếm chỗ nhau trên cùng một phím KHÔNG được cùng màu vệt', () => {
    // Bảy chiêu Nguyên Anh thay bảy chiêu Luyện Khí trên đúng cùng một phím
    // (xem `game/Loadout.ts`). Nếu chúng cùng cặp màu thì người chơi vừa đột phá
    // bấm phím quen thuộc và thấy y hệt cái cũ — mất luôn cảm giác đã lên cấp.
    //
    // Nguy cơ này KHÔNG hiển nhiên: các cặp đó cố tình cùng vai trò, nên phần
    // lớn cũng cùng ngũ hành, nên mặc định chúng rơi vào đúng một cặp màu.
    const bySlot = new Map<number, typeof SKILLS>()
    for (const def of SKILLS) {
      const list = bySlot.get(def.slot) ?? []
      list.push(def)
      bySlot.set(def.slot, list as never)
    }
    for (const [slot, list] of bySlot) {
      if (list.length < 2) continue
      const seen = new Map<string, string>()
      for (const def of list) {
        const c = skillTrail(def.id, def.element)
        const key = `${c.head}-${c.tail}`
        const other = seen.get(key)
        expect(other, `ô ${slot}: ${def.name} trùng màu vệt với ${other}`).toBeUndefined()
        seen.set(key, def.name)
      }
    }
  })

  it('Phong Độn Thuật không dùng cặp chủ đạo', () => {
    // Cú lướt và cú chạy bộ cùng là một đường thẳng ngang mặt đất: cùng màu nữa
    // thì nó đọc ra là "chạy nhanh một nhịp", không phải một chiêu
    const chuDao = skillTrail('__khongCoChieuNay__', 'vo')
    expect(skillTrail('phongDon', 'vo')).not.toEqual(chuDao)
  })
})
