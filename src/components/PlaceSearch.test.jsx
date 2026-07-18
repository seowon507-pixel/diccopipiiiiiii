import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import PlaceSearch from './PlaceSearch'

describe('PlaceSearch', () => {
  it('selects a search result with the keyboard', async () => {
    const place = {
      id: 'place-1',
      x: '126.925',
      y: '37.557',
      place_name: '홍대입구역',
      road_address_name: '서울 마포구 양화로',
      address_name: '서울 마포구 동교동',
      category_name: '교통 > 지하철역',
      phone: '',
      place_url: 'https://place.map.kakao.com/1',
    }
    const kakao = {
      maps: {
        LatLng: function LatLng(lat, lng) {
          this.lat = lat
          this.lng = lng
        },
        services: {
          Status: { OK: 'OK' },
          Places: vi.fn(function Places() {
            this.keywordSearch = (_query, callback) => callback([place], 'OK')
          }),
        },
      },
    }
    const kakaoMap = { setCenter: vi.fn(), setLevel: vi.fn() }
    const onSelectPlace = vi.fn()
    const user = userEvent.setup()

    render(
      <PlaceSearch
        kakao={kakao}
        kakaoMap={kakaoMap}
        onWriteHere={vi.fn()}
        onSelectPlace={onSelectPlace}
      />,
    )

    await user.type(screen.getByPlaceholderText('장소, 건물 검색'), '홍대입구역')
    await user.click(screen.getByRole('button', { name: '검색' }))
    const result = screen.getByRole('button', { name: /홍대입구역.*서울 마포구 양화로/ })
    result.focus()
    await user.keyboard('{Enter}')

    expect(onSelectPlace).toHaveBeenCalledWith(expect.objectContaining({ name: '홍대입구역' }))
    expect(kakaoMap.setCenter).toHaveBeenCalledOnce()
  })
})
