import { useRef, useState } from 'react'
import MapView from './MapView.jsx'
import CommunityPage from './components/CommunityPage.jsx'
import ChatRoom from './components/ChatRoom.jsx'
import MenuPage from './components/MenuPage.jsx'
import PostDetail from './components/PostDetail.jsx'
import PostModal from './components/PostModal.jsx'
import TabBar from './components/TabBar.jsx'
import { useUserLocation } from './useUserLocation'
import { usePosts, EXTERNAL_DISTANCE_METERS } from './usePosts'
import {
  createPost,
  deletePost,
  incrementConfirmCount,
  incrementLikes,
  removePostImage,
  updatePost,
  uploadPostImage,
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
import { getDistanceMeters } from './geo'

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
  const {
    displayLocation,
    trustedLocation,
    locationStatus,
    locationError,
    isLocationTrusted,
    retryLocation,
  } = useUserLocation()
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
  } = usePosts(displayLocation)

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
  const [quickCategory, setQuickCategory] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [locationActionError, setLocationActionError] = useState(null)
  const [communityTarget, setCommunityTarget] = useState(null)
  // null이면 새 글 작성, 값이 있으면 해당 게시글 수정 모드
  const [editTarget, setEditTarget] = useState(null)
  // 실패 후 재시도해도 같은 ID/소유 토큰을 보내 원자 RPC가 중복 글을 만들지 않게 한다.
  const pendingCreateRef = useRef(null)

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

  // 글쓰기 모달을 연다 — 지도 핀 글쓰기/질문 등록, 장소검색 "여기에 글쓰기",
  // 위치·건물별 커뮤니티 "글쓰기" 등 어디서든 이 함수 하나로 진입한다.
  // 5분 이내 반경 50m 안에 내가 쓴 글이 있으면 새 글 대신 그 글을 수정하도록 연다.
  // onConvertPin을 넘기면(핀에서 시작한 경우) 작성 성공 시 그 핀을 지우도록 호출한다.
  function openCreateModal(lat, lng, { presetCategory = null, onConvertPin = null } = {}) {
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

        const created = await createPost({
          id: request.id,
          actorToken: getActorToken(),
          ownerSecret: request.ownerSecret,
          authorLat: trustedLocation.lat,
          authorLng: trustedLocation.lng,
          lat: pendingPosition.lat,
          lng: pendingPosition.lng,
          category,
          title,
          content,
          imageUrl,
          icon,
        })
        upsertPost(created)
        saveLastPost({ id: created.id, lat: pendingPosition.lat, lng: pendingPosition.lng })
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

  return (
    <div className="app">
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
            onOpenCreateModal={openCreateModal}
          />
        </section>

        <section className="app-tab-panel" hidden={activeTab !== 'community'} aria-hidden={activeTab !== 'community'}>
          <CommunityPage
            posts={activePosts}
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
          />
        </section>
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
