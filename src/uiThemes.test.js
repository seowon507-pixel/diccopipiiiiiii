import { beforeEach, describe, expect, it } from 'vitest'
import { BASE_UI_THEME, getSavedUiTheme, saveUiTheme, UI_THEME_OPTIONS } from './uiThemes'

describe('uiThemes', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('기본 시안과 추가 시안 5종을 제공한다', () => {
    expect(BASE_UI_THEME).toBe('alley')
    expect(UI_THEME_OPTIONS).toHaveLength(5)
    expect(new Set(UI_THEME_OPTIONS.map((theme) => theme.key)).size).toBe(5)
  })

  it('선택한 유효 시안을 저장하고 다시 불러온다', () => {
    saveUiTheme('civic')
    expect(getSavedUiTheme()).toBe('civic')
  })

  it('알 수 없는 저장값은 기본 시안으로 안전하게 되돌린다', () => {
    localStorage.setItem('woorimadong_ui_theme_preview', 'unknown-theme')
    expect(getSavedUiTheme()).toBe(BASE_UI_THEME)
  })
})
