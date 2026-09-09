import { describe, expect, it } from 'vitest'
import { Rng } from '@/core/Rng'
import { ITEMS } from '../data/items'
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
})
