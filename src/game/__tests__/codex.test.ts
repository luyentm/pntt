import { describe, expect, it } from 'vitest'
import {
  CODEX,
  CODEX_CATEGORY_LABEL,
  codexByCategory,
  codexEntry,
  codexRealm,
  codexUnit,
  type CodexCategory,
} from '../data/codex'
import { SKILLS } from '../data/skills'
import { UNITS } from '../data/units'

describe('Đồ Giám', () => {
  it('id không trùng nhau', () => {
    const ids = new Set(CODEX.map((e) => e.id))
    expect(ids.size).toBe(CODEX.length)
  })

  it('ba ngăn đều có mục', () => {
    for (const c of Object.keys(CODEX_CATEGORY_LABEL) as CodexCategory[]) {
      expect(codexByCategory(c).length, c).toBeGreaterThan(0)
    }
  })

  it('mục nào cũng có tagline và đoạn giới thiệu đủ dài để đọc', () => {
    for (const e of CODEX) {
      expect(e.tagline.length, e.id).toBeGreaterThan(10)
      expect(e.lore.length, e.id).toBeGreaterThan(60)
    }
  })

  it('mọi id chiêu trỏ tới đều có thật', () => {
    // Bảng dữ liệu tự ném lỗi lúc nạp module, nhưng vẫn kiểm lại ở đây: chỗ ném
    // lỗi kia dễ bị ai đó gỡ đi vì tưởng là thừa
    const known = new Set(SKILLS.map((s) => s.id))
    for (const e of CODEX) {
      for (const id of e.skills ?? []) expect(known.has(id), `${e.id} → ${id}`).toBe(true)
    }
  })

  it('mọi unitId trỏ tới đều có thật', () => {
    for (const e of CODEX) {
      if (!e.unitId) continue
      expect(UNITS[e.unitId], `${e.id} → ${e.unitId}`).toBeDefined()
    }
  })

  it('mục lấy chỉ số từ bảng đơn vị thì KHÔNG tự khai cảnh giới', () => {
    // Hai nguồn cho cùng một con số là hai chỗ để nói khác nhau. `codexRealm`
    // ưu tiên bảng đơn vị, nên một giá trị tự khai bên cạnh `unitId` là chữ
    // chết — nó nằm trong file, trông như sự thật, mà không bao giờ được đọc.
    for (const e of CODEX) {
      if (!e.unitId) continue
      expect(e.realm, e.id).toBeUndefined()
      expect(codexRealm(e), e.id).toBe(codexUnit(e)?.realm)
    }
  })

  it('★ Hàn Lập liệt kê ĐỦ mọi chiêu trong bảng pháp thuật', () => {
    // Đồ Giám là chỗ người chơi tra "hắn có những gì". Sót một chiêu ở đây là
    // nói dối về đúng câu hỏi mà cả trang này sinh ra để trả lời.
    const hanLap = codexEntry('hanLap')
    const listed = new Set(hanLap.skills ?? [])
    for (const def of SKILLS) expect(listed.has(def.id), def.name).toBe(true)
    expect(listed.size).toBe(SKILLS.length)
  })

  it('mọi con quái trong bảng đơn vị đều có mặt trong Đồ Giám', () => {
    const listed = new Set(CODEX.flatMap((e) => (e.unitId ? [e.unitId] : [])))
    for (const id of Object.keys(UNITS)) expect(listed.has(id), id).toBe(true)
  })
})
