import { MathUtils, type Group } from 'three'
import { BEAST_ATTACK, BEAST_DIE, BEAST_HURT, BEAST_IDLE, BEAST_RUN, BEAST_WALK } from '@/anim/clips/beast'
import { ATTACK_COMBO, DIE, HURT, UPPER_BODY } from '@/anim/clips/combat'
import { IDLE, RUN, WALK } from '@/anim/clips/locomotion'
import type { Beast } from '@/art/buildBeast'
import type { Chibi } from '@/art/buildChibi'
import type { CombatantView } from './Combatant'

/**
 * Tốc độ mà clip được tạo cho. Dùng để chỉnh timeScale theo tốc độ thật, nhờ vậy
 * nhịp bước chân khớp với chuyển động thay vì bàn chân trượt trên đất.
 */
const WALK_CLIP_SPEED = 2.0
const RUN_CLIP_SPEED = 4.4
const BEAST_WALK_CLIP_SPEED = 2.2
const BEAST_RUN_CLIP_SPEED = 5.0

const IDLE_THRESHOLD = 0.2
const RUN_THRESHOLD = 2.7

/** Người chibi. */
export class ChibiView implements CombatantView {
  constructor(private readonly chibi: Chibi) {}

  get root(): Group {
    return this.chibi.root
  }

  get height(): number {
    return this.chibi.height
  }

  showIdle(): void {
    this.chibi.animator.play(IDLE)
    this.chibi.animator.timeScale = 1
  }

  showMove(speed: number): void {
    const a = this.chibi.animator
    if (speed < IDLE_THRESHOLD) {
      a.play(IDLE)
      a.timeScale = 1
    } else if (speed < RUN_THRESHOLD) {
      a.play(WALK)
      a.timeScale = MathUtils.clamp(speed / WALK_CLIP_SPEED, 0.65, 1.7)
    } else {
      a.play(RUN)
      a.timeScale = MathUtils.clamp(speed / RUN_CLIP_SPEED, 0.7, 1.6)
    }
  }

  /**
   * Đòn đánh là LỚP PHỦ chỉ trên thân trên, nên chân vẫn giữ chu kỳ chạy —
   * đánh được trong lúc đang di chuyển.
   */
  showAttack(comboStep: number): void {
    const clip = ATTACK_COMBO[comboStep % ATTACK_COMBO.length]
    if (clip) this.chibi.animator.playOverlay(clip, UPPER_BODY)
  }

  showHurt(): void {
    // Trúng đòn thì bỏ lớp phủ: đang vung kiếm mà bị đánh thì phải mất nhịp
    this.chibi.animator.clearOverlay()
    this.chibi.animator.play(HURT, 0.05)
    this.chibi.animator.timeScale = 1
  }

  showDie(): void {
    this.chibi.animator.clearOverlay()
    this.chibi.animator.play(DIE, 0.08)
    this.chibi.animator.timeScale = 1
  }

  update(frameDt: number): void {
    this.chibi.animator.update(frameDt)
  }
}

/** Thú bốn chân. */
export class BeastView implements CombatantView {
  constructor(private readonly beast: Beast) {}

  get root(): Group {
    return this.beast.root
  }

  get height(): number {
    return this.beast.height
  }

  showIdle(): void {
    this.beast.animator.play(BEAST_IDLE)
    this.beast.animator.timeScale = 1
  }

  showMove(speed: number): void {
    const a = this.beast.animator
    if (speed < IDLE_THRESHOLD) {
      a.play(BEAST_IDLE)
      a.timeScale = 1
    } else if (speed < RUN_THRESHOLD) {
      a.play(BEAST_WALK)
      a.timeScale = MathUtils.clamp(speed / BEAST_WALK_CLIP_SPEED, 0.6, 1.8)
    } else {
      a.play(BEAST_RUN)
      a.timeScale = MathUtils.clamp(speed / BEAST_RUN_CLIP_SPEED, 0.7, 1.7)
    }
  }

  /**
   * Thú vồ bằng cả người nên KHÔNG dùng lớp phủ — đòn vồ là clip toàn thân.
   * (Người thì chỉ vung tay nên phủ được lên thân trên.)
   */
  showAttack(_comboStep: number): void {
    this.beast.animator.play(BEAST_ATTACK, 0.06)
    this.beast.animator.timeScale = 1
  }

  showHurt(): void {
    this.beast.animator.play(BEAST_HURT, 0.05)
    this.beast.animator.timeScale = 1
  }

  showDie(): void {
    this.beast.animator.play(BEAST_DIE, 0.08)
    this.beast.animator.timeScale = 1
  }

  update(frameDt: number): void {
    this.beast.animator.update(frameDt)
  }
}
