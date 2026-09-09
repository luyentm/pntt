import { describe, expect, it } from 'vitest'
import { Rng } from '@/core/Rng'
import { realmOrdinal } from '../data/realms'
import { ITEMS } from '../data/items'
import { UNITS } from '../data/units'
import { DROPS, rollDrops, tuViReward } from '../data/dropTables'

describe('bảng rơi vật phẩm', () => {
  it('mọi id trong bảng rơi đều là vật phẩm có thật', () => {
    // Một lỗi chính tả ở đây sẽ ném lỗi giữa lúc đánh nhau, khi Inventory.add
    // gọi itemDef — nghĩa là lỗi chỉ hiện ra sau một cú giết may rủi
    for (const [tableId, table] of Object.entries(DROPS)) {
      expect(table.tuVi, tableId).toBeGreaterThan(0)
      for (const entry of table.entries) {
        expect(ITEMS[entry.id], `${tableId} → ${entry.id}`).toBeDefined()
        expect(entry.chance).toBeGreaterThan(0)
        expect(entry.chance).toBeLessThanOrEqual(1)
        expect(entry.min).toBeGreaterThan(0)
        expect(entry.max).toBeGreaterThanOrEqual(entry.min)
      }
    }
  })

  it('cùng seed cho cùng kết quả', () => {
    const a = rollDrops('hacLang', new Rng(42))
    const b = rollDrops('hacLang', new Rng(42))
    expect(a).toEqual(b)
  })

  it('seed khác thì kết quả khác — bảng rơi thật sự may rủi', () => {
    const runs = new Set<string>()
    for (let seed = 0; seed < 40; seed++) {
      runs.add(JSON.stringify(rollDrops('hacLang', new Rng(seed))))
    }
    expect(runs.size).toBeGreaterThan(5)
  })

  it('số lượng luôn nằm trong khoảng min..max của bảng', () => {
    for (let seed = 0; seed < 400; seed++) {
      for (const tableId of Object.keys(DROPS)) {
        for (const drop of rollDrops(tableId, new Rng(seed))) {
          const entry = DROPS[tableId]!.entries.find((e) => e.id === drop.id)
          expect(entry, `${tableId} → ${drop.id}`).toBeDefined()
          expect(drop.count).toBeGreaterThanOrEqual(entry!.min)
          expect(drop.count).toBeLessThanOrEqual(entry!.max)
        }
      }
    }
  })

  it('bảng không tồn tại thì không rơi gì và không nổ', () => {
    expect(rollDrops('khongCoConNay', new Rng(1))).toEqual([])
    expect(tuViReward('khongCoConNay')).toBe(0)
  })

  it('quái mạnh hơn cho nhiều Tu Vi hơn', () => {
    // Nếu ngược lại thì người chơi sẽ farm con dễ nhất, và cả thang cảnh giới
    // mất luôn ý nghĩa dẫn đường
    expect(tuViReward('hacLang')).toBeGreaterThan(tuViReward('yeuThu'))
  })

  it('MỌI đơn vị trong bảng đơn vị đều có bảng rơi', () => {
    // Đây là lỗi đã xảy ra thật: M7 thêm 6 đơn vị mới mà không thêm bảng rơi.
    // Không có lỗi nào được ném ra — `tuViReward` chỉ trả về 0 — nên hạ Thiết
    // Giáp Thi, ma đạo tán tu và cả Mặc Đại Phu đều được 0 Tu Vi và 0 vật phẩm,
    // tức là cả nửa sau của game không trả thưởng gì.
    for (const id of Object.keys(UNITS)) {
      expect(DROPS[id], `thiếu bảng rơi cho "${id}"`).toBeDefined()
      expect(tuViReward(id), `"${id}" cho 0 Tu Vi`).toBeGreaterThan(0)
    }
  })

  it('đơn vị ở cảnh giới cao hơn cho nhiều Tu Vi hơn', () => {
    const byRealm = Object.keys(UNITS)
      .map((id) => ({ id, ordinal: realmOrdinal(UNITS[id]!.realm), tuVi: tuViReward(id) }))
      .sort((a, b) => a.ordinal - b.ordinal)
    for (let i = 1; i < byRealm.length; i++) {
      const prev = byRealm[i - 1]!
      const cur = byRealm[i]!
      // Cùng cảnh giới thì không ràng buộc; cao hơn thì phải thưởng hơn
      if (cur.ordinal > prev.ordinal) {
        expect(cur.tuVi, `${cur.id} vs ${prev.id}`).toBeGreaterThan(prev.tuVi)
      }
    }
  })

  it('tướng rơi nguyên liệu quý CHẮC CHẮN, không may rủi', () => {
    // Tướng chỉ gặp một lần mỗi lượt chơi. Để rơi theo xác suất thì có người
    // hạ được tướng mà nhận đúng mấy viên linh thạch, và cảm giác "vừa làm được
    // một việc lớn" biến mất.
    for (const id of ['maDaoTrucCo', 'macDaiPhu']) {
      const table = DROPS[id]!
      const guaranteed = table.entries.filter((e) => e.chance >= 1)
      expect(guaranteed.length, id).toBeGreaterThanOrEqual(3)
    }
  })
})
