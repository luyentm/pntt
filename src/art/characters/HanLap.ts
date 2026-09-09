import { Palette } from '@/art/Palette'
import { buildChibi, type Chibi } from '@/art/buildChibi'

/**
 * Hàn Lập — nhân vật người chơi.
 * Áo lam của đệ tử Thất Huyền Môn, viền trắng ngà, đai lưng nâu.
 */
export function buildHanLap(): Chibi {
  return buildChibi({
    name: 'HanLap',
    height: 1,
    detail: 'full',
    robe: Palette.aoHanLap,
    robeDark: Palette.aoHanLapDam,
    trim: Palette.vienAo,
    sash: Palette.daiLung,
    skin: Palette.daNguoi,
    hair: Palette.toc,
    boot: Palette.than,
    eye: Palette.mat,
  })
}

/** Đệ tử đồng môn — cùng dáng, áo nhạt hơn, ít chi tiết hơn. */
export function buildDeTu(): Chibi {
  return buildChibi({
    name: 'DeTu',
    height: 0.96,
    detail: 'simple',
    robe: Palette.aoDeTu,
    robeDark: Palette.aoDeTuDam,
    trim: Palette.vienAo,
    sash: Palette.daiLung,
    skin: Palette.daNguoi,
    hair: Palette.toc,
    boot: Palette.than,
    eye: Palette.mat,
  })
}
