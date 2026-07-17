import { useState } from 'react'
import MapView from './MapView.jsx'
import CommunityPage from './components/CommunityPage.jsx'
import ChatRoom from './components/ChatRoom.jsx'
import MenuPage from './components/MenuPage.jsx'
import PostDetail from './components/PostDetail.jsx'
import PostModal from './components/PostModal.jsx'
import TabBar from './components/TabBar.jsx'
import { useUserLocation } from './useUserLocation'
import { usePosts, EXTERNAL_DISTANCE_METERS } from './usePosts'
import { createPost, updatePost, uploadPostImage, incrementConfirmCount, incrementLikes, deletePost } from './supabaseClient'
import { findNearbyDuplicate, saveLastPost } from './abuseCheck'
import { getOwnerSecret, forgetOwnership, isMyPost, saveOwnership, generateOwnerSecret } from './myPosts'
import { getDistanceMeters } from './geo'

// 지도/커뮤니티/채팅은 별도 탭으로 분리되어 있지만, 위치와 게시글 목록은 여기서 한 번만 구독해 셋이 공유한다.
// 게시글 상세(PostDetail)/작성 모달(PostModal)도 여기서 관리해서 어느 탭(지도 핀, 위치·건물별
// 커뮤니티 등)에서 "글쓰기"를 눌러도 같은 흐름을 탄다 — 각 탭에서 업로드/등록 로직을 중복 구현하지 않는다.
function App() {
  const [activeTab, setActiveTab] = useState('map')
  const { userLocation, locationLoading, locationDenied } = useUserLocation()
  const { posts, setPosts, activePosts, nearbyPosts, communityPosts, activeCategories, toggleCategory } = usePosts(userLocation)

  const [selectedPostId, setSelectedPostId] = useState(null)
  const [confirmingPostId, setConfirmingPostId] = useState(null)
  const [likingPostId, setLikingPostId] = useState(null)
  const [deletingPostId, setDeletingPostId] = useState(null)

  // 글쓰기 모달 상태 — 어느 화면(지도 핀/장소검색/위치·건물별 커뮤니티)에서 열든 공유한다.
  const [modalOpen, setModalOpen] = useState(false)
  const [pendingPosition, setPendingPosition] = useState(null)
  // 핀에서 시작한 글쓰기가 성공하면 그 빈 핀을 지워야 한다 — 핀은 MapView가 자체 관리하는
  // 지도 전용 개념이라, 변환 콜백만 여기서 넘겨받아 성공 시 호출한다.
  const [pendingPinConvert, setPendingPinConvert] = useState(null)
  const [quickCategory, setQuickCategory] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  // null이면 새 글 작성, 값이 있으면 해당 게시글 수정 모드
  const [editTarget, setEditTarget] = useState(null)

  const selectedPost = posts.find((post) => post.id === selectedPostId) ?? null

  // "아직 그런가요?" 확인 시 confirm_count를 1 증가시킨다. 화면 반영은 realtime UPDATE로 처리한다.
  async function handleConfirm(post) {
    if (confirmingPostId === post.id) return

    setConfirmingPostId(post.id)
    try {
      await incrementConfirmCount(post.id, post.confirm_count)
    } catch (err) {
      console.error('[App] confirm_count 갱신 실패', err)
    } finally {
      setConfirmingPostId(null)
    }
  }

  // 추천(좋아요) 시 likes_count를 1 증가시킨다.
  async function handleLike(post) {
    if (likingPostId === post.id) return

    setLikingPostId(post.id)
    try {
      await incrementLikes(post.id, post.likes_count ?? 0)
    } catch (err) {
      console.error('[App] likes_count 갱신 실패', err)
    } finally {
      setLikingPostId(null)
    }
  }

  // 작성자 본인만 삭제 가능(서버가 owner_secret 일치 여부를 확인한다).
  async function handleDeletePost(post) {
    const ownerSecret = getOwnerSecret(post.id)
    if (!ownerSecret) return

    setDeletingPostId(post.id)
    try {
      const deleted = await deletePost(post.id, ownerSecret)
      if (deleted) {
        forgetOwnership(post.id)
        setPosts((prev) => prev.filter((p) => p.id !== post.id))
        setSelectedPostId(null)
      }
    } catch (err) {
      console.error('[App] 게시글 삭제 실패', err)
    } finally {
      setDeletingPostId(null)
    }
  }

  // 글쓰기 모달을 연다 — 지도 핀 글쓰기/질문 등록, 장소검색 "여기에 글쓰기",
  // 위치·건물별 커뮤니티 "글쓰기" 등 어디서든 이 함수 하나로 진입한다.
  // 5분 이내 반경 50m 안에 내가 쓴 글이 있으면 새 글 대신 그 글을 수정하도록 연다.
  // onConvertPin을 넘기면(핀에서 시작한 경우) 작성 성공 시 그 핀을 지우도록 호출한다.
  function openCreateModal(lat, lng, { presetCategory = null, onConvertPin = null } = {}) {
    setSubmitError(null)
    setPendingPosition({ lat, lng })
    setPendingPinConvert(() => onConvertPin)

    const duplicate = findNearbyDuplicate(lat, lng)
    const existingPost = duplicate ? posts.find((post) => post.id === duplicate.id) : null

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
    } else {
      setEditTarget(null)
      setQuickCategory(presetCategory)
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
  }

  async function handleSubmitPost({ category, title, content, imageFile, removeImage, icon }) {
    if (!pendingPosition) return

    setSubmitting(true)
    setSubmitError(null)
    try {
      const imageUrl = imageFile
        ? await uploadPostImage(imageFile)
        : (removeImage ? null : editTarget?.image_url ?? null)

      if (editTarget) {
        await updatePost(editTarget.id, { category, title, content, imageUrl, icon })
        saveLastPost({ id: editTarget.id, lat: editTarget.lat, lng: editTarget.lng })
      } else {
        const distanceFromMe = userLocation
          ? getDistanceMeters(userLocation.lat, userLocation.lng, pendingPosition.lat, pendingPosition.lng)
          : 0
        const postType = distanceFromMe > EXTERNAL_DISTANCE_METERS ? 'external' : 'local'
        const ownerSecret = generateOwnerSecret()

        const created = await createPost({
          lat: pendingPosition.lat,
          lng: pendingPosition.lng,
          category,
          title,
          content,
          postType,
          imageUrl,
          icon,
          ownerSecret,
        })
        saveLastPost({ id: created.id, lat: pendingPosition.lat, lng: pendingPosition.lng })
        saveOwnership(created.id, ownerSecret)
      }

      if (pendingPinConvert) {
        await pendingPinConvert()
      }

      closeCreateModal()
    } catch (err) {
      console.error('[App] 게시글 저장 실패', err)
      setSubmitError('저장에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  const willBeExternal = !editTarget && Boolean(pendingPosition) && Boolean(userLocation)
    && getDistanceMeters(userLocation.lat, userLocation.lng, pendingPosition.lat, pendingPosition.lng) > EXTERNAL_DISTANCE_METERS

  return (
    <div className="app">
      <div className="app-content">
        {activeTab === 'map' && (
          <MapView
            userLocation={userLocation}
            locationLoading={locationLoading}
            locationDenied={locationDenied}
            nearbyPosts={nearbyPosts}
            activePosts={activePosts}
            activeCategories={activeCategories}
            onToggleCategory={toggleCategory}
            onSelectPost={setSelectedPostId}
            selectedPostId={selectedPostId}
            onOpenCommunity={() => setActiveTab('community')}
            onOpenCreateModal={openCreateModal}
          />
        )}

        {activeTab === 'community' && (
          <CommunityPage
            posts={communityPosts}
            activeCategories={activeCategories}
            onToggleCategory={toggleCategory}
            onSelectPost={setSelectedPostId}
            fallbackPosts={activePosts}
          />
        )}

        {activeTab === 'chat' && <ChatRoom userLocation={userLocation} />}

        {activeTab === 'menu' && (
          <MenuPage
            posts={activePosts}
            activeCategories={activeCategories}
            onToggleCategory={toggleCategory}
            onSelectPost={setSelectedPostId}
            onOpenCreateModal={openCreateModal}
            userLocation={userLocation}
          />
        )}
      </div>

      <TabBar activeTab={activeTab} onChange={setActiveTab} />

      {selectedPost && (
        <PostDetail
          post={selectedPost}
          onClose={() => setSelectedPostId(null)}
          onConfirm={() => handleConfirm(selectedPost)}
          confirming={confirmingPostId === selectedPost.id}
          onLike={() => handleLike(selectedPost)}
          liking={likingPostId === selectedPost.id}
          isMine={isMyPost(selectedPost.id)}
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
