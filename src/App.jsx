import { useEffect, useRef, useState } from 'react'
import MapView from './MapView.jsx'
import CommunityPage from './components/CommunityPage.jsx'
import ChatRoom from './components/ChatRoom.jsx'
import MenuPage from './components/MenuPage.jsx'
import PostDetail from './components/PostDetail.jsx'
import PostModal from './components/PostModal.jsx'
import QuickPostSheet from './components/QuickPostSheet.jsx'
import Toast from './components/Toast.jsx'
import TabBar from './components/TabBar.jsx'
import Onboarding from './components/Onboarding.jsx'
import AuthGate from './components/AuthGate.jsx'
import AppIcon from './components/AppIcon.jsx'
import { hasSeenOnboarding, markOnboardingSeen } from './onboarding'
import { subscribeToAuthState, fetchMyUsername, signOut } from './auth'
import { fetchCurrentAppRole } from './moderation'
import { useUserLocation } from './useUserLocation'
import { usePosts, EXTERNAL_DISTANCE_METERS } from './usePosts'
import {
  backendConfigurationError,
  createPost,
  deletePost,
  incrementConfirmCount,
  incrementLikes,
  removePostImage,
  isMissingRpcError,
  updatePost,
  uploadPostImage,
  useDummyData,
} from './supabaseClient'
import { findNearbyDuplicate, saveLastPost } from './abuseCheck'
import {
  forgetOwnership,
  generateOwnerSecret,
  getActorToken,
  getOwnerSecret,
  isMyPost,
  saveOwnership,
} from './myPosts'
import { maybeFuzzLocation } from './geoPrivacy'
import { getDistanceMeters } from './geo'
import { QUICK_POST_MESSAGES } from './categories'
import { getOrCreateDeviceSecret } from './notifications'
import { UI_THEME } from './uiThemes'

function createRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16)
    const value = character === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

// 지도/커뮤니티/채팅은 별도 탭으로 분리되어 있지만, 위치와 게시글 목록은 여기서 한 번만 구독해 셋이 공유한다.
// 게시글 상세(PostDetail)/작성 모달(PostModal)도 여기서 관리해서 어느 탭(지도 핀, 위치·건물별
// 커뮤니티 등)에서 "글쓰기"를 눌러도 같은 흐름을 탄다 — 각 탭에서 업로드/등록 로직을 중복 구현하지 않는다.
function App() {
  const [activeTab, setActiveTab] = useState('map')

  useEffect(() => {
    document.documentElement.dataset.uiTheme = UI_THEME
    return () => {
      delete document.documentElement.dataset.uiTheme
    }
  }, [])
  // 로그인 게이트 — undefined는 "아직 세션 확인 전"을 뜻한다. 명시적인 개발용 더미 모드는
  // 실제 Supabase Auth를 호출하지 않고 로컬 샘플 사용자로 진입한다.
  const [session, setSession] = useState(() => (
    useDummyData
      ? { user: { id: 'dummy-songsim-user' } }
      : (backendConfigurationError ? null : undefined)
  ))
  const [authStatusError, setAuthStatusError] = useState(null)
  useEffect(() => {
    if (useDummyData || backendConfigurationError) return undefined
    return subscribeToAuthState(
      (nextSession) => {
        setAuthStatusError(null)
        setSession(nextSession)
      },
      (error) => {
        console.error('[App] 세션 확인 실패', error)
        setAuthStatusError('로그인 상태를 확인하지 못했습니다. 네트워크를 확인하고 다시 로그인해주세요.')
      },
    )
  }, [])
  const authReady = useDummyData || Boolean(backendConfigurationError) || session !== undefined
  const authenticated = useDummyData || Boolean(backendConfigurationError) || Boolean(session)

  // 로그인 후 고유 아이디(profiles.username) 조회 — undefined는 "아직 조회 전", null은
  // "로그인은 했지만 아이디를 아직 안 정함"을 뜻한다. userId가 바뀔 때만(로그인/로그아웃) 다시 조회한다.
  const [username, setUsername] = useState(() => (useDummyData ? 'songsim_demo' : null))
  useEffect(() => {
    if (useDummyData) {
      setUsername('songsim_demo')
      return undefined
    }
    const userId = session?.user?.id
    if (!userId) {
      setUsername(null)
      return
    }
    setUsername(undefined)
    let cancelled = false
    fetchMyUsername(userId)
      .then((value) => { if (!cancelled) setUsername(value) })
      .catch((err) => {
        console.error('[App] 아이디 조회 실패', err)
        if (!cancelled) setUsername(null)
      })
    return () => { cancelled = true }
  }, [session?.user?.id])
  const profileReady = useDummyData || Boolean(backendConfigurationError) || username !== undefined
  const hasUsername = useDummyData || Boolean(backendConfigurationError) || Boolean(username)

  // 관리자 여부는 사용자 편의를 위한 메뉴 노출에만 사용한다. 실제 신고 데이터 접근과
  // 조치 권한은 Supabase의 RLS/RPC가 매 요청마다 다시 검증한다.
  const [appRole, setAppRole] = useState('user')
  useEffect(() => {
    if (useDummyData || !session?.user?.id || !hasUsername || backendConfigurationError) {
      setAppRole('user')
      return undefined
    }

    let cancelled = false
    fetchCurrentAppRole()
      .then((role) => { if (!cancelled) setAppRole(role) })
      .catch((error) => {
        // 원격 DB에 관리자 마이그레이션을 적용하기 전에도 일반 사용자 기능은 유지한다.
        if (!isMissingRpcError(error)) console.error('[App] 앱 권한 조회 실패', error)
        if (!cancelled) setAppRole('user')
      })
    return () => { cancelled = true }
  }, [hasUsername, session?.user?.id])

  // 로그인·아이디·온보딩이 모두 끝나기 전에는 위치 권한과 게시글 API 요청을 시작하지 않는다.
  const [onboarded, setOnboarded] = useState(() => useDummyData || hasSeenOnboarding())
  const appDataEnabled = authenticated && hasUsername && onboarded
  const {
    displayLocation,
    trustedLocation,
    locationStatus,
    locationError,
    isLocationTrusted,
    retryLocation,
  } = useUserLocation(appDataEnabled)
  const {
    posts,
    activePosts,
    nearbyPosts,
    activeCategories,
    toggleCategory,
    enableAllCategories,
    postsStatus,
    postsError,
    refetchPosts,
    upsertPost,
    removePost,
    communityPosts,
    now,
  } = usePosts(displayLocation, { enabled: appDataEnabled })

  const [selectedPostId, setSelectedPostId] = useState(null)
  const [confirmingPostId, setConfirmingPostId] = useState(null)
  const [likingPostId, setLikingPostId] = useState(null)
  const [deletingPostId, setDeletingPostId] = useState(null)
  const [postActionError, setPostActionError] = useState(null)

  // 글쓰기 모달 상태 — 어느 화면(지도 핀/장소검색/위치·건물별 커뮤니티)에서 열든 공유한다.
  const [modalOpen, setModalOpen] = useState(false)
  const [pendingPosition, setPendingPosition] = useState(null)
  // 핀에서 시작한 글쓰기가 성공하면 그 빈 핀을 지워야 한다 — 핀은 MapView가 자체 관리하는
  // 지도 전용 개념이라, 변환 콜백만 여기서 넘겨받아 성공 시 호출한다.
  const [pendingPinConvert, setPendingPinConvert] = useState(null)
  // 이 글의 위치가 "내 현재 위치"에서 온 것인지(→ 위치 보호 시 흐림 대상). 지도에서 직접 찍거나
  // 장소검색으로 고른 위치는 false라 정확히 등록된다.
  const [pendingBlurLocation, setPendingBlurLocation] = useState(false)
  const [quickCategory, setQuickCategory] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [locationActionError, setLocationActionError] = useState(null)
  const [communityTarget, setCommunityTarget] = useState(null)
  // null이면 새 글 작성, 값이 있으면 해당 게시글 수정 모드
  const [editTarget, setEditTarget] = useState(null)
  // 실패 후 재시도해도 같은 ID/소유 토큰을 보내 원자 RPC가 중복 글을 만들지 않게 한다.
  const pendingCreateRef = useRef(null)

  // FAB → 카테고리 그리드로 "현재 위치 + 카테고리 1개"만으로 즉시 등록하는 빠른 글쓰기 흐름.
  // 기존 openCreateModal(위치를 먼저 고르고 제목/내용까지 채우는 전체 작성)과는 별개 경로다 —
  // "자세히 쓰기" 링크를 누를 때만 openCreateModal로 넘어간다.
  const [quickPostOpen, setQuickPostOpen] = useState(false)
  const [quickSubmitting, setQuickSubmitting] = useState(false)
  const [toast, setToast] = useState(null)
  // MapView에 "이 위치로 옮겨줘"를 알리는 값 — 매번 새 객체를 넘겨서 좌표가 같아도 재중심 효과가 다시 뜬다.
  const [recenterTarget, setRecenterTarget] = useState(null)

  const selectedPost = posts.find((post) => post.id === selectedPostId) ?? null

  // mutation 응답을 즉시 반영하고 Realtime은 다른 사용자 변경을 보완하는 경로로 쓴다.
  async function handleConfirm(post) {
    if (confirmingPostId === post.id) return

    setConfirmingPostId(post.id)
    setPostActionError(null)
    try {
      const updated = await incrementConfirmCount(post.id, getActorToken())
      upsertPost(updated)
    } catch (err) {
      console.error('[App] confirm_count 갱신 실패', err)
      setPostActionError('현황 확인을 반영하지 못했어요. 다시 시도해 주세요.')
    } finally {
      setConfirmingPostId(null)
    }
  }

  // 추천(좋아요) 시 likes_count를 1 증가시킨다.
  async function handleLike(post) {
    if (likingPostId === post.id) return

    setLikingPostId(post.id)
    setPostActionError(null)
    try {
      const updated = await incrementLikes(post.id, getActorToken())
      upsertPost(updated)
    } catch (err) {
      console.error('[App] likes_count 갱신 실패', err)
      setPostActionError('추천을 반영하지 못했어요. 다시 시도해 주세요.')
    } finally {
      setLikingPostId(null)
    }
  }

  // 작성자 본인만 삭제 가능(서버가 owner_secret 일치 여부를 확인한다).
  async function handleDeletePost(post) {
    const ownerSecret = getOwnerSecret(post.id)
    if (!ownerSecret) return

    setDeletingPostId(post.id)
    setPostActionError(null)
    try {
      const deleted = await deletePost(post.id, ownerSecret)
      if (deleted) {
        forgetOwnership(post.id)
        removePost(post.id)
        setSelectedPostId(null)
      } else {
        setPostActionError('작성자 권한을 확인하지 못해 삭제하지 못했어요.')
      }
    } catch (err) {
      console.error('[App] 게시글 삭제 실패', err)
      setPostActionError('게시글을 삭제하지 못했어요. 다시 시도해 주세요.')
    } finally {
      setDeletingPostId(null)
    }
  }

  // FAB에서 카테고리 하나를 고르면 그 자리에서 바로 등록까지 끝낸다(제목/사진 없음, 항상 현재
  // 위치라 postType은 늘 'local'). 성공하면 시트를 닫고 지도 탭으로 옮긴 뒤 그 글 위치로
  // 재중심하고 토스트를 띄운다. saveLastPost로 기록해두면 5분/50m 이내에 "자세히 쓰기"나
  // 다른 글쓰기 진입점으로 같은 자리에 다시 들어와도 findNearbyDuplicate가 이 글을 찾아
  // 수정 모드로 열어준다(중복 글 방지 로직 재사용, 새로 안 만듦).
  async function handleQuickPost(category) {
    if (!isLocationTrusted || !trustedLocation || quickSubmitting) return

    setQuickSubmitting(true)
    try {
      // 빠른 등록은 항상 "내 현재 위치"에 올리는 글이라, 위치 보호가 켜져 있으면 대략적인
      // 위치로 흐려서 등록한다(집 등 정확한 현재 좌표 노출 방지). 지도에서 직접 찍은 위치가
      // 아니므로 흐려도 사용자 의도와 어긋나지 않는다.
      const postLocation = maybeFuzzLocation(trustedLocation)
      const ownerSecret = generateOwnerSecret()
      const id = createRequestId()
      const created = await createPost({
        id,
        actorToken: getActorToken(),
        authorLat: trustedLocation.lat,
        authorLng: trustedLocation.lng,
        lat: postLocation.lat,
        lng: postLocation.lng,
        category,
        title: null,
        content: QUICK_POST_MESSAGES[category],
        imageUrl: null,
        icon: null,
        ownerSecret,
        deviceSecret: getOrCreateDeviceSecret(),
      })
      saveLastPost({ id: created.id, lat: postLocation.lat, lng: postLocation.lng })
      if (!saveOwnership(created.id, ownerSecret)) {
        await deletePost(created.id, ownerSecret)
        throw new Error('이 브라우저에 소유권 정보를 저장할 수 없습니다.')
      }
      upsertPost(created)

      setQuickPostOpen(false)
      setActiveTab('map')
      setRecenterTarget({ lat: postLocation.lat, lng: postLocation.lng })
      setToast({ key: created.id, message: '등록됐어요!' })
    } catch (err) {
      console.error('[App] 빠른 등록 실패', err)
      setToast({ key: `quick-post-error-${Date.now()}`, message: '등록에 실패했어요. 다시 시도해주세요.' })
    } finally {
      setQuickSubmitting(false)
    }
  }

  // 빠른 등록 시트의 "자세히 쓰기" — 시트를 닫고 같은 위치(현재 내 위치)로 기존 전체 작성
  // 모달(제목/내용/사진 다 채우는 openCreateModal)을 그대로 연다.
  function handleOpenDetailedFromQuick() {
    setQuickPostOpen(false)
    // 빠른 등록에서 이어지는 자세히 쓰기도 "내 현재 위치" 기준이라 위치 보호(흐림) 대상이다.
    if (trustedLocation) openCreateModal(trustedLocation.lat, trustedLocation.lng, { blurLocation: true })
  }

  // 글쓰기 모달을 연다 — 지도 핀 글쓰기/질문 등록, 장소검색 "여기에 글쓰기",
  // 위치·건물별 커뮤니티 "글쓰기" 등 어디서든 이 함수 하나로 진입한다.
  // 5분 이내 반경 50m 안에 내가 쓴 글이 있으면 새 글 대신 그 글을 수정하도록 연다.
  // onConvertPin을 넘기면(핀에서 시작한 경우) 작성 성공 시 그 핀을 지우도록 호출한다.
  function openCreateModal(lat, lng, { presetCategory = null, onConvertPin = null, blurLocation = false } = {}) {
    const duplicate = findNearbyDuplicate(lat, lng)
    const existingPost = duplicate ? posts.find((post) => post.id === duplicate.id) : null

    // 기존 내 글 수정은 새 위치 데이터를 만들지 않으므로 위치 권한이 사라져도 허용한다.
    if (!existingPost && (!isLocationTrusted || !trustedLocation)) {
      setLocationActionError('현재 위치를 확인해야 새 글과 채팅을 작성할 수 있어요.')
      return
    }

    setLocationActionError(null)
    setSubmitError(null)
    setPendingPosition({ lat, lng })
    setPendingPinConvert(() => onConvertPin)
    setPendingBlurLocation(blurLocation)

    if (existingPost) {
      setEditTarget({
        id: existingPost.id,
        lat: existingPost.lat,
        lng: existingPost.lng,
        category: existingPost.category,
        title: existingPost.title,
        content: existingPost.content,
        image_url: existingPost.image_url,
        icon: existingPost.icon,
      })
      setQuickCategory(null)
      pendingCreateRef.current = null
    } else {
      setEditTarget(null)
      setQuickCategory(presetCategory)
      pendingCreateRef.current = {
        id: createRequestId(),
        ownerSecret: generateOwnerSecret(),
      }
    }

    setModalOpen(true)
  }

  function closeCreateModal() {
    setModalOpen(false)
    setPendingPosition(null)
    setSubmitError(null)
    setEditTarget(null)
    setPendingPinConvert(null)
    setPendingBlurLocation(false)
    setQuickCategory(null)
    pendingCreateRef.current = null
  }

  function openEditModal(post) {
    if (!post || !isMyPost(post.id)) return

    setSelectedPostId(null)
    setPostActionError(null)
    setLocationActionError(null)
    setSubmitError(null)
    setPendingPosition({ lat: post.lat, lng: post.lng })
    setPendingPinConvert(null)
    setQuickCategory(null)
    setEditTarget({
      id: post.id,
      lat: post.lat,
      lng: post.lng,
      category: post.category,
      title: post.title,
      content: post.content,
      image_url: post.image_url,
      icon: post.icon,
    })
    pendingCreateRef.current = null
    setModalOpen(true)
  }

  async function handleSubmitPost({ category, title, content, imageFile, removeImage, icon }) {
    if (!pendingPosition) return
    if (!editTarget && (!isLocationTrusted || !trustedLocation)) {
      setSubmitError('현재 위치를 다시 확인한 뒤 저장해 주세요.')
      return
    }

    setSubmitting(true)
    setSubmitError(null)
    let uploadedImageUrl = null
    try {
      const imageUrl = imageFile
        ? await uploadPostImage(imageFile)
        : (removeImage ? null : editTarget?.image_url ?? null)
      if (imageFile) uploadedImageUrl = imageUrl

      if (editTarget) {
        const ownerSecret = getOwnerSecret(editTarget.id)
        if (!ownerSecret) throw new Error('게시글 소유권 정보를 찾을 수 없습니다.')

        const updated = await updatePost(editTarget.id, ownerSecret, { category, title, content, imageUrl, icon })
        upsertPost(updated)
        saveLastPost({ id: editTarget.id, lat: editTarget.lat, lng: editTarget.lng })

      } else {
        const request = pendingCreateRef.current ?? {
          id: createRequestId(),
          ownerSecret: generateOwnerSecret(),
        }
        pendingCreateRef.current = request

        // 현재 위치에서 시작한 빠른/상세 작성만 동네 수준으로 흐리고, 사용자가 지도에서
        // 직접 고른 공개 장소는 그대로 저장한다.
        const postLocation = pendingBlurLocation ? maybeFuzzLocation(pendingPosition) : pendingPosition
        const created = await createPost({
          id: request.id,
          actorToken: getActorToken(),
          ownerSecret: request.ownerSecret,
          authorLat: trustedLocation.lat,
          authorLng: trustedLocation.lng,
          lat: postLocation.lat,
          lng: postLocation.lng,
          category,
          title,
          content,
          imageUrl,
          icon,
          deviceSecret: getOrCreateDeviceSecret(),
        })
        upsertPost(created)
        saveLastPost({ id: created.id, lat: postLocation.lat, lng: postLocation.lng })
        if (!saveOwnership(created.id, request.ownerSecret)) {
          await deletePost(created.id, request.ownerSecret)
          removePost(created.id)
          throw new Error('이 브라우저에 소유권 정보를 저장할 수 없습니다.')
        }
      }

      if (pendingPinConvert) {
        try {
          await pendingPinConvert()
        } catch (error) {
          console.warn('[App] 게시글로 전환한 핀 정리 실패', error)
        }
      }

      closeCreateModal()
    } catch (err) {
      console.error('[App] 게시글 저장 실패', err)
      if (uploadedImageUrl) {
        removePostImage(uploadedImageUrl).catch((error) => {
          console.warn('[App] 실패한 업로드 이미지 정리 실패', error)
        })
      }
      setSubmitError(err?.message || '저장에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  const willBeExternal = !editTarget && Boolean(pendingPosition) && Boolean(trustedLocation)
    && getDistanceMeters(trustedLocation.lat, trustedLocation.lng, pendingPosition.lat, pendingPosition.lng) > EXTERNAL_DISTANCE_METERS

  function openTargetCommunity(target) {
    setCommunityTarget(target ?? null)
    setActiveTab('community')
  }

  function handleTabChange(nextTab) {
    if (nextTab === 'community') setCommunityTarget(null)
    setActiveTab(nextTab)
  }

  // 세션/프로필 확인이 끝나기 전에는 로그인 화면이 잠깐 번쩍이는 것을 막기 위해 아무것도 그리지 않는다.
  if (!authReady || (authenticated && !profileReady)) return null

  // 로그인(이메일+비밀번호 가입/인증 또는 인증코드) + 아이디 설정이 끝나기 전에는
  // 온보딩/앱 대신 로그인 게이트를 보여준다.
  if (!authenticated || !hasUsername) {
    return (
      <AuthGate
        session={authenticated ? session : null}
        statusError={authStatusError}
        onUsernameSaved={setUsername}
      />
    )
  }

  // 온보딩 미완료 시 앱(위치 요청 포함) 대신 소개 화면을 먼저 보여준다.
  if (!onboarded) {
    return (
      <Onboarding
        onStart={() => {
          markOnboardingSeen()
          setOnboarded(true)
        }}
      />
    )
  }

  return (
    <div className="app" data-ui-theme={UI_THEME}>
      <div className="app-content">
        {postsStatus === 'error' && (
          <div className="app-status-banner" role="alert">
            <span>{postsError?.message || '게시글을 불러오지 못했습니다.'}</span>
            <button type="button" onClick={refetchPosts}>다시 시도</button>
          </div>
        )}

        {locationActionError && (
          <div className="app-status-banner" role="alert">
            <span>{locationActionError}</span>
            <button
              type="button"
              onClick={() => {
                setLocationActionError(null)
                retryLocation()
              }}
            >
              위치 다시 확인
            </button>
          </div>
        )}

        <section className="app-tab-panel" hidden={activeTab !== 'map'} aria-hidden={activeTab !== 'map'}>
          <MapView
            active={activeTab === 'map'}
            userLocation={displayLocation}
            locationLoading={locationStatus === 'loading'}
            locationDenied={!isLocationTrusted && locationStatus !== 'loading'}
            locationError={locationError}
            isLocationTrusted={isLocationTrusted}
            nearbyPosts={nearbyPosts}
            activePosts={activePosts}
            activeCategories={activeCategories}
            onToggleCategory={toggleCategory}
            onSelectPost={setSelectedPostId}
            onOpenCommunity={openTargetCommunity}
            selectedPostId={selectedPostId}
            onOpenCreateModal={openCreateModal}
            onOpenQuickPost={() => setQuickPostOpen(true)}
            recenterTarget={recenterTarget}
          />
        </section>

        <section className="app-tab-panel" hidden={activeTab !== 'community'} aria-hidden={activeTab !== 'community'}>
          <CommunityPage
            posts={communityPosts}
            userLocation={displayLocation}
            isLocationTrusted={isLocationTrusted}
            locationStatus={locationStatus}
            communityTarget={communityTarget}
            onResetTarget={() => setCommunityTarget(null)}
            postsStatus={postsStatus}
            postsError={postsError}
            onRetry={refetchPosts}
            onWrite={openCreateModal}
            activeCategories={activeCategories}
            onToggleCategory={toggleCategory}
            onEnableAllCategories={enableAllCategories}
            onSelectPost={setSelectedPostId}
            fallbackPosts={activePosts}
            now={now}
          />
        </section>

        <section className="app-tab-panel" hidden={activeTab !== 'chat'} aria-hidden={activeTab !== 'chat'}>
          <ChatRoom
            active={activeTab === 'chat'}
            displayLocation={displayLocation}
            trustedLocation={trustedLocation}
            locationStatus={locationStatus}
            onRetryLocation={retryLocation}
          />
        </section>

        <section className="app-tab-panel" hidden={activeTab !== 'menu'} aria-hidden={activeTab !== 'menu'}>
          <MenuPage
            posts={activePosts}
            activeCategories={activeCategories}
            onToggleCategory={toggleCategory}
            onSelectPost={setSelectedPostId}
            onOpenCreateModal={openCreateModal}
            userLocation={displayLocation}
            now={now}
            onOpenQuickPost={() => setQuickPostOpen(true)}
            quickPostDisabled={!isLocationTrusted}
            username={username}
            appRole={appRole}
            onSignOut={useDummyData
              ? () => setToast({ key: `dummy-signout-${Date.now()}`, message: '샘플 모드에서는 로그아웃하지 않아요.' })
              : signOut}
          />
        </section>

        {/* 지도·커뮤니티에서는 현장 기록 버튼을 띄우고, 메뉴에서는 목록 안의 전용 버튼을 쓴다. */}
        {(activeTab === 'map' || activeTab === 'community') && (
          <button
            type="button"
            className={`quick-post-fab quick-post-fab--${activeTab}`}
            aria-label="빠르게 글쓰기"
            disabled={!isLocationTrusted}
            onClick={() => setQuickPostOpen(true)}
          >
            <AppIcon name="compose" size={21} />
            <span className="quick-post-fab-label">글쓰기</span>
          </button>
        )}

        <QuickPostSheet
          open={quickPostOpen}
          submitting={quickSubmitting}
          onSelectCategory={handleQuickPost}
          onOpenDetailedModal={handleOpenDetailedFromQuick}
          onClose={() => setQuickPostOpen(false)}
        />

        {toast && <Toast key={toast.key} message={toast.message} onDismiss={() => setToast(null)} />}
      </div>

      <TabBar activeTab={activeTab} onChange={handleTabChange} />

      {selectedPost && (
        <PostDetail
          post={selectedPost}
          onClose={() => {
            setSelectedPostId(null)
            setPostActionError(null)
          }}
          actionError={postActionError}
          onConfirm={() => handleConfirm(selectedPost)}
          confirming={confirmingPostId === selectedPost.id}
          onLike={() => handleLike(selectedPost)}
          liking={likingPostId === selectedPost.id}
          isMine={isMyPost(selectedPost.id)}
          onEdit={() => openEditModal(selectedPost)}
          onDelete={() => handleDeletePost(selectedPost)}
          deleting={deletingPostId === selectedPost.id}
        />
      )}

      <PostModal
        open={modalOpen}
        submitting={submitting}
        errorMessage={submitError}
        isEditing={Boolean(editTarget)}
        willBeExternal={willBeExternal}
        initialCategory={editTarget?.category ?? quickCategory ?? null}
        initialTitle={editTarget?.title ?? ''}
        initialContent={editTarget?.content ?? ''}
        initialImageUrl={editTarget?.image_url ?? null}
        initialIcon={editTarget?.icon ?? null}
        onSubmit={handleSubmitPost}
        onClose={closeCreateModal}
      />
    </div>
  )
}

export default App
