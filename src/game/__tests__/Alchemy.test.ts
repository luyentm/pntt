import { describe, expect, it } from 'vitest'
import { Rng } from '@/core/Rng'
import { availableRecipes, canCraft, craft, craftChance } from '../Alchemy'
import { Inventory } from '../Inventory'
import { REALM, type RealmPosition } from '../data/realms'
import { recipeById } from '../data/recipes'

const LOW: RealmPosition = { major: REALM.LUYEN_KHI, tier: 0 }
const HIGH: RealmPosition = { major: REALM.KET_DAN, tier: 0 }

function succeed(): Rng {
  const r = new Rng(1)
  r.next = () => 0
  return r
}
function fail(): Rng {
  const r = new Rng(1)
  r.next = () => 0.999999
  return r
}

function stocked(recipeId: string, times = 1): Inventory {
  const inv = new Inventory()
  for (const need of recipeById(recipeId).needs) inv.add(need.id, need.count * times)
  return inv
}

describe('Alchemy', () => {
  it('Thần Thức tăng tỉ lệ thành công', () => {
    // Gắn hai vòng lặp vào cùng một trục tiến bộ: tu luyện làm luyện đan dễ hơn
    const recipe = recipeById('hoiKhiDan')
    expect(craftChance(recipe, 100)).toBeGreaterThan(craftChance(recipe, 5))
  })

  it('tỉ lệ có trần, không bao giờ 100%', () => {
    expect(craftChance(recipeById('hoiKhiDan'), 100000)).toBeLessThan(1)
  })

  it('chặn khi chưa đủ cảnh giới', () => {
    const check = canCraft(recipeById('trucCoDan'), stocked('trucCoDan'), LOW, 50, 999)
    expect(check.ok).toBe(false)
    expect(check.block).toBe('chuaDuCanhGioi')
  })

  it('chặn khi thiếu nguyên liệu, và LIỆT KÊ thiếu bao nhiêu', () => {
    const check = canCraft(recipeById('hoiKhiDan'), new Inventory(), LOW, 10, 999)
    expect(check.ok).toBe(false)
    expect(check.block).toBe('thieuNguyenLieu')
    expect(check.missing).toEqual([{ id: 'thanhNguyenThao', count: 2 }])
  })

  it('chặn khi thiếu linh lực', () => {
    const check = canCraft(recipeById('hoiKhiDan'), stocked('hoiKhiDan'), LOW, 10, 0)
    expect(check.ok).toBe(false)
    expect(check.block).toBe('thieuLinhLuc')
  })

  it('thành công thì tiêu nguyên liệu và cho ra đan dược', () => {
    const recipe = recipeById('hoiKhiDan')
    const inv = stocked('hoiKhiDan')
    const r = craft(recipe, inv, LOW, 10, 999, succeed())
    expect(r.success).toBe(true)
    expect(inv.count('hoiKhiDan')).toBe(recipe.outputCount)
    expect(inv.count('thanhNguyenThao')).toBe(0)
  })

  it('thất bại thì HOÀN LẠI một nửa nguyên liệu', () => {
    // Thời gian đi hái linh thảo là thời gian chơi thật; bốc hơi hết sau một
    // lần roll xấu sẽ khiến người chơi không dám luyện nữa
    const inv = stocked('hoiKhiDan')
    const r = craft(recipeById('hoiKhiDan'), inv, LOW, 10, 999, fail())
    expect(r.success).toBe(false)
    expect(inv.count('hoiKhiDan')).toBe(0)
    expect(inv.count('thanhNguyenThao')).toBe(1) // 2 -> hoàn 1
    expect(r.refunded).toEqual([{ id: 'thanhNguyenThao', count: 1 }])
  })

  it('luyện được nhiều lô nếu đủ nguyên liệu', () => {
    const inv = stocked('hoiKhiDan', 3)
    const rng = succeed()
    for (let i = 0; i < 3; i++) craft(recipeById('hoiKhiDan'), inv, LOW, 10, 999, rng)
    expect(inv.count('hoiKhiDan')).toBe(6)
    expect(inv.count('thanhNguyenThao')).toBe(0)
  })

  it('gọi craft khi không đủ điều kiện thì BÁO LỖI, không im lặng', () => {
    expect(() => craft(recipeById('hoiKhiDan'), new Inventory(), LOW, 10, 999, succeed())).toThrow()
  })

  it('availableRecipes mở dần theo cảnh giới', () => {
    const low = availableRecipes(LOW)
    const high = availableRecipes(HIGH)
    expect(low.length).toBeGreaterThan(0)
    expect(high.length).toBeGreaterThan(low.length)
    // Trúc Cơ Đan không được mở ngay khi mới nhập môn
    expect(low.some((r) => r.id === 'trucCoDan')).toBe(false)
  })

  it('luyện được Trúc Cơ Đan khi đủ cảnh giới và nguyên liệu', () => {
    // Đây là mục tiêu dài hạn của cả bản demo
    const realm: RealmPosition = { major: REALM.LUYEN_KHI, tier: 10 }
    const inv = stocked('trucCoDan')
    const r = craft(recipeById('trucCoDan'), inv, realm, 60, 999, succeed())
    expect(r.success).toBe(true)
    expect(inv.count('trucCoDan')).toBe(1)
  })
})
