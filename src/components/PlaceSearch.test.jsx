import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import PlaceSearch from './PlaceSearch'

describe('PlaceSearch', () => {
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

  function createKakao(callback = (done) => done([place], 'OK')) {
    return {
      maps: {
        LatLng: function LatLng(lat, lng) {
          this.lat = lat
          this.lng = lng
        },
        services: {
          Status: { OK: 'OK' },
          Places: vi.fn(function Places() {
            this.keywordSearch = (_query, done) => callback(done)
          }),
        },
      },
    }
  }

  it('selects a search result with the keyboard', async () => {
    const kakao = createKakao()
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

  it('shows loading state and closes results with Escape while restoring input focus', async () => {
    let finishSearch
    const kakao = createKakao((done) => { finishSearch = done })
    const user = userEvent.setup()

    render(
      <PlaceSearch kakao={kakao} kakaoMap={{}} onWriteHere={vi.fn()} onSelectPlace={vi.fn()} />,
    )

    const input = screen.getByPlaceholderText('장소, 건물 검색')
    await user.type(input, '홍대')
    await user.click(screen.getByRole('button', { name: '검색' }))
    expect(screen.getByRole('status')).toHaveTextContent('검색 중')

    await act(async () => finishSearch([place], 'OK'))
    await screen.findByRole('button', { name: /홍대입구역.*서울 마포구 양화로/ })
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('region', { name: '장소 검색 결과' })).not.toBeInTheDocument()
    expect(input).toHaveFocus()
  })

  it('dismisses results when the user clicks outside the search', async () => {
    const user = userEvent.setup()
    render(
      <>
        <button type="button">지도 영역</button>
        <PlaceSearch kakao={createKakao()} kakaoMap={{}} onWriteHere={vi.fn()} onSelectPlace={vi.fn()} />
      </>,
    )

    await user.type(screen.getByPlaceholderText('장소, 건물 검색'), '홍대')
    await user.click(screen.getByRole('button', { name: '검색' }))
    await waitFor(() => expect(screen.getByRole('region', { name: '장소 검색 결과' })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: '지도 영역' }))

    expect(screen.queryByRole('region', { name: '장소 검색 결과' })).not.toBeInTheDocument()
  })
})
