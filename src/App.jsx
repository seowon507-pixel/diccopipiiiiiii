import { useState } from 'react'
import MapView from './MapView.jsx'
import CommunityPage from './components/CommunityPage.jsx'
import ChatRoom from './components/ChatRoom.jsx'
import PostDetail from './components/PostDetail.jsx'
import TabBar from './components/TabBar.jsx'
import { useUserLocation } from './useUserLocation'
import { usePosts } from './usePosts'
import { incrementConfirmCount, incrementLikes, deletePost } from './supabaseClient'
import { getOwnerSecret, forgetOwnership, isMyPost } from './myPosts'

// 지도/커뮤니티/채팅은 별도 탭으로 분리되어 있지만, 위치와 게시글 목록은 여기서 한 번만 구독해 셋이 공유한다.
// 게시글 상세(PostDetail)도 여기서 관리해서 어느 탭에서 글을 선택하든 같은 오버레이가 뜬다.
function App() {
  const [activeTab, setActiveTab] = useState('map')
  const { userLocation, locationLoading, locationDenied } = useUserLocation()
  const { posts, setPosts, nearbyPosts, activeCategories, toggleCategory } = usePosts(userLocation)

  const [selectedPostId, setSelectedPostId] = useState(null)
  const [confirmingPostId, setConfirmingPostId] = useState(null)
  const [likingPostId, setLikingPostId] = useState(null)
  const [deletingPostId, setDeletingPostId] = useState(null)

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

  return (
    <div className="app">
      <div className="app-content">
        {activeTab === 'map' && (
          <MapView
            userLocation={userLocation}
            locationLoading={locationLoading}
            locationDenied={locationDenied}
            nearbyPosts={nearbyPosts}
            activeCategories={activeCategories}
            onToggleCategory={toggleCategory}
            onSelectPost={setSelectedPostId}
            onOpenCommunity={() => setActiveTab('community')}
          />
        )}

        {activeTab === 'community' && (
          <CommunityPage
            posts={nearbyPosts}
            activeCategories={activeCategories}
            onToggleCategory={toggleCategory}
            onSelectPost={setSelectedPostId}
          />
        )}

        {activeTab === 'chat' && <ChatRoom userLocation={userLocation} />}
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
    </div>
  )
}

export default App
