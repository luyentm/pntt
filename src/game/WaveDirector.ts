import { WAVES, type SpawnGroup, type WaveDef } from './data/waves'

export type WaveState =
  /** Chưa mở đợt nào — chờ người chơi bấm khởi trận. */
  | 'idle'
  /** Đang báo tên đợt, quái chưa sinh. */
  | 'announcing'
  /** Đang đánh. */
  | 'fighting'
  /** Vừa dẹp xong một đợt — chờ người chơi bấm mở đợt sau. */
  | 'cleared'
  /** Người chơi bị hạ giữa đợt: đợt này phải làm lại. */
  | 'failed'
  /** Hạ được tướng cuối. */
  | 'victory'

/** Những gì bộ điều phối YÊU CẦU màn làm. Nó không tự sinh gì cả. */
export interface WaveActions {
  spawnGroup(group: SpawnGroup): void
  spawnAllies(count: number): void
  /** Dẹp sạch quái còn sót (dùng khi đợt thất bại). */
  clearEnemies(): void
  announce(text: string, kind: 'wave' | 'good' | 'bad'): void
  /** Đợt tướng bắt đầu / kết thúc — màn bật tắt thanh máu tướng. */
  bossWave(unitId: string | null): void
}

/** Thời gian báo trước trước khi quái sinh. */
const ANNOUNCE = 2.2
/** Sau khi bị hạ, chờ bấy nhiêu rồi mới cho làm lại đợt. */
const FAIL_PAUSE = 3

/**
 * Bộ điều phối đợt của "Thất Huyền Môn thủ trận".
 *
 * Thuần logic: nó không cầm scene, không cầm three, không sinh gì — chỉ đọc hai
 * con số (còn mấy con sống, người chơi chết chưa) và GỌI YÊU CẦU qua `WaveActions`.
 * Nhờ vậy chạy được toàn bộ 6 đợt trong test mà không cần đồ hoạ, và cân bằng
 * nhịp đợt không phải mở trình duyệt.
 *
 * Đợt sau KHÔNG tự chạy tiếp — phải người chơi bấm. Xem lý do trong `data/waves.ts`.
 */
export class WaveDirector {
  state: WaveState = 'idle'
  /** Chỉ số đợt hiện tại, 0-based. */
  index = 0
  /** Đồng hồ của trạng thái đang chạy. */
  timer = 0
  /** Số đợt đã dẹp xong. */
  cleared = 0
  /** Số lần bị hạ trong cả lượt chơi — để hiện ở màn thắng. */
  deaths = 0

  /**
   * Đã thật sự thấy quái của đợt này còn sống hay chưa.
   *
   * Cần vì đợt chuyển sang 'fighting' trong CÙNG lời gọi đã yêu cầu sinh quái,
   * còn màn thì đếm số quái sống TRƯỚC khi gọi vào đây. Không có cờ này thì cái
   * số 0 cũ của bước trước sẽ làm đợt tự dẹp ngay khoảnh khắc vừa sinh, và cả
   * trận chạy hết 6 đợt trong hai giây mà không có con quái nào xuất hiện.
   */
  private sawEnemies = false

  get current(): WaveDef | null {
    return WAVES[this.index] ?? null
  }

  get total(): number {
    return WAVES.length
  }

  get isBossWave(): boolean {
    return this.current?.boss !== undefined
  }

  /** Đang ở trạng thái mà người chơi được bấm mở đợt. */
  get canStart(): boolean {
    return this.state === 'idle' || this.state === 'cleared'
  }

  /** Người chơi bấm khởi trận. Trả về false nếu chưa tới lúc. */
  start(actions: WaveActions): boolean {
    if (!this.canStart) return false
    const wave = this.current
    if (!wave) return false
    this.state = 'announcing'
    this.timer = ANNOUNCE
    actions.announce(wave.announce, 'wave')
    return true
  }

  fixedUpdate(dt: number, aliveEnemies: number, playerDead: boolean, actions: WaveActions): void {
    // Bị hạ giữa đợt thì đợt tính là thất bại, bất kể trạng thái nào đang chạy.
    // Kiểm tra TRƯỚC switch: nếu để trong nhánh 'fighting' thì chết đúng lúc
    // đang báo trước sẽ không được tính, và đợt vẫn sinh quái lên một cái xác.
    if (playerDead && (this.state === 'fighting' || this.state === 'announcing')) {
      this.fail(actions)
      return
    }

    switch (this.state) {
      case 'announcing': {
        this.timer -= dt
        if (this.timer > 0) return
        const wave = this.current
        if (!wave) return
        for (const group of wave.groups) actions.spawnGroup(group)
        if (wave.allies > 0) actions.spawnAllies(wave.allies)
        actions.bossWave(wave.boss ?? null)
        this.state = 'fighting'
        this.timer = 0
        this.sawEnemies = false
        return
      }

      case 'fighting': {
        this.timer += dt
        // Chỉ dùng SỐ QUÁI CÒN SỐNG làm điều kiện dẹp xong, không dùng đồng hồ:
        // đợt phải kết thúc vì người chơi đánh xong, không vì hết giờ
        if (aliveEnemies > 0) {
          this.sawEnemies = true
          return
        }
        if (!this.sawEnemies) return
        this.clearWave(actions)
        return
      }

      case 'failed': {
        this.timer -= dt
        if (this.timer > 0) return
        // Về lại trạng thái chờ, đợt KHÔNG tăng — người chơi làm lại đợt vừa rồi
        this.state = 'cleared'
        actions.announce('Chuẩn bị lại rồi khởi trận', 'bad')
        return
      }

      default:
        return
    }
  }

  private clearWave(actions: WaveActions): void {
    const wave = this.current
    this.cleared++
    actions.bossWave(null)

    if (this.index >= WAVES.length - 1) {
      this.state = 'victory'
      actions.announce('Thủ trận thành công — sơn môn còn nguyên', 'good')
      return
    }

    this.index++
    this.state = 'cleared'
    actions.announce(
      wave?.boss ? 'Hạ được tướng. Nghỉ lấy hơi rồi khởi trận tiếp' : 'Dẹp xong. Khởi trận khi đã sẵn sàng',
      'good',
    )
  }

  private fail(actions: WaveActions): void {
    this.state = 'failed'
    this.timer = FAIL_PAUSE
    this.deaths++
    // Dẹp sạch quái của đợt thất bại: để lại thì người chơi vừa hồi sinh đã bị
    // cả đợt cũ vây, và không bao giờ gỡ lại được
    actions.clearEnemies()
    actions.bossWave(null)
    actions.announce('Trọng thương — đợt này phải làm lại', 'bad')
  }

  reset(): void {
    this.state = 'idle'
    this.sawEnemies = false
    this.index = 0
    this.timer = 0
    this.cleared = 0
    this.deaths = 0
  }
}
