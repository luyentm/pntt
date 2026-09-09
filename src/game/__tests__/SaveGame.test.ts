import { describe, expect, it } from 'vitest'
import { REALM } from '../data/realms'
import { Cultivation } from '../Cultivation'
import { Inventory } from '../Inventory'
import {
  SAVE_KEY,
  SAVE_VERSION,
  clearSave,
  describeSave,
  hasSave,
  loadGame,
  migrate,
  restore,
  saveGame,
  type SaveStorage,
} from '../SaveGame'
import { DEFAULT_SETTINGS, FPS_CAP_CHOICES, SETTINGS_KEY, loadSettings, saveSettings } from '../Settings'

/** localStorage giả. `fail` để thử đường hết dung lượng / bị chặn. */
function fakeStorage(fail = false): SaveStorage & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return {
    map,
    getItem(k) {
      if (fail) throw new Error('bị chặn')
      return map.get(k) ?? null
    },
    setItem(k, v) {
      if (fail) throw new Error('hết dung lượng')
      map.set(k, v)
    },
    removeItem(k) {
      if (fail) throw new Error('bị chặn')
      map.delete(k)
    },
  }
}

function sampleState() {
  const cultivation = new Cultivation({ major: REALM.TRUC_CO, tier: 1 })
  cultivation.tuVi = 123.5
  cultivation.failStreak = 2
  cultivation.linhNhu = 44
  cultivation.gainTuVi(0) // không đổi gì, chỉ để chắc trạng thái hợp lệ
  const inventory = new Inventory()
  inventory.add('linhThachHa', 42)
  inventory.add('trucCoDan', 1)
  return {
    cultivation: cultivation.toJSON(),
    inventory: inventory.toJSON(),
    wave: { index: 3, cleared: 3, deaths: 1 },
    playTime: 930,
  }
}

describe('SaveGame', () => {
  it('lưu rồi nạp lại ra đúng trạng thái cũ', () => {
    const s = fakeStorage()
    const state = sampleState()
    expect(saveGame(s, state, 1_700_000_000_000)).toBe(true)

    const loaded = loadGame(s)
    expect(loaded).not.toBeNull()
    expect(loaded!.version).toBe(SAVE_VERSION)
    expect(loaded!.cultivation).toEqual(state.cultivation)
    expect(loaded!.inventory).toEqual(state.inventory)
    expect(loaded!.wave).toEqual(state.wave)
    expect(loaded!.playTime).toBe(930)
  })

  it('dựng lại được Cultivation và Inventory chạy được', () => {
    const s = fakeStorage()
    saveGame(s, sampleState(), 1)
    const { cultivation, inventory } = restore(loadGame(s)!)
    expect(cultivation.realm.major).toBe(REALM.TRUC_CO)
    expect(cultivation.realm.tier).toBe(1)
    expect(cultivation.name).toContain('Trúc Cơ')
    expect(inventory.count('linhThachHa')).toBe(42)
    expect(inventory.has('trucCoDan')).toBe(true)
  })

  it('chưa có gì thì nạp ra null, không nổ', () => {
    const s = fakeStorage()
    expect(loadGame(s)).toBeNull()
    expect(hasSave(s)).toBe(false)
  })

  it('localStorage bị chặn thì lưu trả về false và nạp ra null, KHÔNG ném lỗi', () => {
    // Chế độ riêng tư của một số trình duyệt ném lỗi ngay khi chạm localStorage.
    // Không chơi được vì thế là một lỗi tệ hơn nhiều so với không lưu được.
    const s = fakeStorage(true)
    expect(saveGame(s, sampleState(), 1)).toBe(false)
    expect(loadGame(s)).toBeNull()
    expect(() => clearSave(s)).not.toThrow()
  })

  it('dữ liệu rác thì bỏ qua, không nổ', () => {
    for (const junk of ['', 'không phải json', '[]', 'null', '"chuỗi"', '{}', '{"version":0}']) {
      const s = fakeStorage()
      s.map.set(SAVE_KEY, junk)
      expect(loadGame(s), junk).toBeNull()
    }
  })

  it('bản lưu của phiên bản MỚI HƠN thì từ chối, không đoán', () => {
    // Đoán ra một trạng thái nửa vời còn tệ hơn bắt đầu lại: người chơi tưởng
    // save còn nguyên rồi mới phát hiện mất đồ
    const s = fakeStorage()
    s.map.set(SAVE_KEY, JSON.stringify({ ...sampleState(), version: SAVE_VERSION + 1 }))
    expect(loadGame(s)).toBeNull()
  })

  it('bản lưu phiên bản 1 (chưa có phần thủ trận) vẫn nạp được', () => {
    const old = {
      version: 1,
      savedAt: 5,
      cultivation: { major: 1, tier: 6, tuVi: 10, failStreak: 0, linhNhu: 0, totalTuVi: 200 },
      inventory: { linhThachHa: 7 },
      playTime: 60,
    }
    const migrated = migrate(old)
    expect(migrated).not.toBeNull()
    expect(migrated!.version).toBe(SAVE_VERSION)
    expect(migrated!.cultivation.tier).toBe(6)
    expect(migrated!.inventory).toEqual({ linhThachHa: 7 })
    // Thiếu `wave` thì coi như chưa đánh đợt nào, không làm cả bản lưu vô giá trị
    expect(migrated!.wave).toEqual({ index: 0, cleared: 0, deaths: 0 })
  })

  it('số âm và số rác trong bản lưu bị kẹp về mức hợp lệ', () => {
    const migrated = migrate({
      version: 1,
      cultivation: { major: -5, tier: -2, tuVi: -100, failStreak: 'x', linhNhu: NaN, totalTuVi: Infinity },
      inventory: { linhThachHa: -3, yeuDan: 2.7, hoiKhiDan: 'nhiều' },
      wave: { index: -1, cleared: -9, deaths: null },
      playTime: -50,
    })
    expect(migrated).not.toBeNull()
    expect(migrated!.cultivation.major).toBe(0)
    expect(migrated!.cultivation.tier).toBe(0)
    expect(migrated!.cultivation.tuVi).toBe(0)
    expect(migrated!.cultivation.failStreak).toBe(0)
    expect(migrated!.cultivation.linhNhu).toBe(0)
    expect(migrated!.inventory.linhThachHa).toBeUndefined() // âm thì bỏ hẳn
    expect(migrated!.inventory.yeuDan).toBe(2) // làm tròn xuống
    expect(migrated!.inventory.hoiKhiDan).toBeUndefined()
    expect(migrated!.wave).toEqual({ index: 0, cleared: 0, deaths: 0 })
    expect(migrated!.playTime).toBe(0)
  })

  it('vật phẩm không còn tồn tại trong bảng thì bị bỏ khi dựng lại túi', () => {
    // Bảng vật phẩm sẽ đổi giữa các phiên bản; save cũ vẫn phải nạp được
    const inv = Inventory.fromJSON({ linhThachHa: 5, monKhongConTonTai: 99 })
    expect(inv.count('linhThachHa')).toBe(5)
    expect(inv.count('monKhongConTonTai')).toBe(0)
  })

  it('describeSave đọc ra được', () => {
    const s = fakeStorage()
    saveGame(s, sampleState(), 1)
    const text = describeSave(loadGame(s)!, 'Trúc Cơ kỳ trung kỳ')
    expect(text).toContain('Trúc Cơ')
    expect(text).toContain('3 đợt')
    expect(text).toContain('15 phút')
  })

  it('clearSave xoá hẳn', () => {
    const s = fakeStorage()
    saveGame(s, sampleState(), 1)
    expect(hasSave(s)).toBe(true)
    clearSave(s)
    expect(hasSave(s)).toBe(false)
  })
})

describe('Settings', () => {
  it('chưa lưu gì thì ra mặc định', () => {
    expect(loadSettings(fakeStorage())).toEqual(DEFAULT_SETTINGS)
  })

  it('lưu rồi nạp lại ra đúng', () => {
    const s = fakeStorage()
    const want = { autoAim: false, resolutionScale: 0.75, shadows: false, postFx: false, fpsCap: 120, sfxVolume: 0.2 }
    saveSettings(s, want)
    expect(loadSettings(s)).toEqual(want)
  })

  it('giá trị vô lý bị KẸP LẠI, không chỉ kiểm kiểu', () => {
    // resolutionScale 40 sẽ cấp phát một framebuffer khổng lồ và treo máy trước
    // khi kịp hiện gì — nên đây không phải chuyện làm cho gọn
    const s = fakeStorage()
    s.map.set(
      SETTINGS_KEY,
      JSON.stringify({ autoAim: 'có', resolutionScale: 40, shadows: 'có', postFx: 1, fpsCap: 999, sfxVolume: -3 }),
    )
    const got = loadSettings(s)
    expect(got.autoAim).toBe(DEFAULT_SETTINGS.autoAim)
    expect(got.resolutionScale).toBe(1)
    expect(got.shadows).toBe(DEFAULT_SETTINGS.shadows)
    expect(got.postFx).toBe(DEFAULT_SETTINGS.postFx)
    expect(got.fpsCap).toBe(DEFAULT_SETTINGS.fpsCap)
    expect(got.sfxVolume).toBe(0)
  })

  it('fpsCap chỉ nhận các mức có trong bảng chọn', () => {
    for (const cap of FPS_CAP_CHOICES) {
      const s = fakeStorage()
      saveSettings(s, { ...DEFAULT_SETTINGS, fpsCap: cap })
      expect(loadSettings(s).fpsCap).toBe(cap)
    }
  })

  it('cài đặt hỏng hoặc storage bị chặn thì ra mặc định, KHÔNG nổ', () => {
    const bad = fakeStorage()
    bad.map.set(SETTINGS_KEY, '{{{')
    expect(loadSettings(bad)).toEqual(DEFAULT_SETTINGS)
    expect(loadSettings(fakeStorage(true))).toEqual(DEFAULT_SETTINGS)
    expect(() => saveSettings(fakeStorage(true), DEFAULT_SETTINGS)).not.toThrow()
  })
})
