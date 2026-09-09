import type { Rng } from '@/core/Rng'
import { realmOrdinal, type RealmPosition } from './data/realms'
import { RECIPES, type Recipe } from './data/recipes'
import type { Inventory, Stack } from './Inventory'

export type CraftBlock = 'chuaDuCanhGioi' | 'thieuNguyenLieu' | 'thieuLinhLuc' | null

export interface CraftCheck {
  ok: boolean
  block: CraftBlock
  /** Nguyên liệu còn thiếu, nếu thiếu. */
  missing: Stack[]
  chance: number
}

export interface CraftResult {
  success: boolean
  chance: number
  output: string
  outputCount: number
  /** Nguyên liệu được hoàn lại khi thất bại. */
  refunded: Stack[]
  linhLucSpent: number
}

/** Thất bại thì hoàn lại bấy nhiêu phần nguyên liệu. */
const FAIL_REFUND = 0.5

/**
 * Luyện đan.
 *
 * Tỉ lệ thành công lên theo Thần Thức, nên tu luyện làm cả việc luyện đan dễ hơn
 * — chứ không chỉ đánh mạnh hơn. Đó là cách gắn hai vòng lặp (chiến đấu và chế
 * tạo) vào cùng một trục tiến bộ.
 */
export function craftChance(recipe: Recipe, thanThuc: number): number {
  return Math.min(0.98, recipe.baseChance + thanThuc * recipe.thanThucBonus)
}

export function canCraft(
  recipe: Recipe,
  inventory: Inventory,
  realm: RealmPosition,
  thanThuc: number,
  linhLuc: number,
): CraftCheck {
  const chance = craftChance(recipe, thanThuc)

  if (realmOrdinal(realm) < realmOrdinal(recipe.requiredRealm)) {
    return { ok: false, block: 'chuaDuCanhGioi', missing: [], chance }
  }

  const missing: Stack[] = []
  for (const need of recipe.needs) {
    const have = inventory.count(need.id)
    if (have < need.count) missing.push({ id: need.id, count: need.count - have })
  }
  if (missing.length > 0) {
    return { ok: false, block: 'thieuNguyenLieu', missing, chance }
  }

  if (linhLuc < recipe.linhLucCost) {
    return { ok: false, block: 'thieuLinhLuc', missing: [], chance }
  }

  return { ok: true, block: null, missing: [], chance }
}

/**
 * Luyện một lô.
 *
 * Thất bại HOÀN LẠI một nửa nguyên liệu (làm tròn xuống). Trong truyện thì luyện
 * đan thất bại là mất trắng, nhưng ở đây thời gian đi hái linh thảo là thời gian
 * chơi thật của người dùng — bốc hơi toàn bộ sau một lần roll xấu sẽ khiến họ
 * không dám luyện, và vòng lặp thu thập mất luôn ý nghĩa.
 */
export function craft(
  recipe: Recipe,
  inventory: Inventory,
  realm: RealmPosition,
  thanThuc: number,
  linhLuc: number,
  rng: Rng,
): CraftResult {
  const check = canCraft(recipe, inventory, realm, thanThuc, linhLuc)
  if (!check.ok) throw new Error(`Không luyện được: ${check.block}`)

  // Trừ nguyên liệu TRƯỚC khi roll: nếu roll trước rồi mới trừ thì một lỗi ném
  // ra ở giữa sẽ để lại trạng thái nửa vời
  inventory.removeAll(recipe.needs)

  const chance = check.chance
  if (rng.chance(chance)) {
    inventory.add(recipe.output, recipe.outputCount)
    return {
      success: true,
      chance,
      output: recipe.output,
      outputCount: recipe.outputCount,
      refunded: [],
      linhLucSpent: recipe.linhLucCost,
    }
  }

  const refunded: Stack[] = []
  for (const need of recipe.needs) {
    const back = Math.floor(need.count * FAIL_REFUND)
    if (back > 0) {
      inventory.add(need.id, back)
      refunded.push({ id: need.id, count: back })
    }
  }
  return {
    success: false,
    chance,
    output: recipe.output,
    outputCount: 0,
    refunded,
    linhLucSpent: recipe.linhLucCost,
  }
}

/** Công thức đã mở theo cảnh giới. */
export function availableRecipes(realm: RealmPosition): Recipe[] {
  return RECIPES.filter((r) => realmOrdinal(realm) >= realmOrdinal(r.requiredRealm))
}
