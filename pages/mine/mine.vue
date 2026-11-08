<template>
	<glass-shell>
	<view class="page">
		<view class="profile">
			<view class="avatar">{{ initial }}</view>
			<view class="profile-main">
				<view class="name-row">
					<view class="name">{{ profile.name }}</view>
					<view class="rename" @click="openRename">改名</view>
				</view>
				<view class="since">
					<text v-if="loggedIn">已登录 · 匿名账号</text>
					<text v-else>未登录 · 也可以发帖</text>
				</view>
			</view>
			<view v-if="loggedIn" class="logout" @click="logout">退出</view>
		</view>

		<view v-if="!loggedIn" class="login-card" @click="toLogin">
			<view class="login-card-title">登录后，可以抱一抱别人</view>
			<view class="login-card-text">只用于识别「这条是我写的」，不会展示你的账号信息。发帖不登录也可以。</view>
			<view class="login-card-btn">去登录</view>
		</view>

		<view class="stats">
			<view class="stat">
				<view class="stat-value">{{ stats.posts }}</view>
				<view class="stat-label">我写的</view>
			</view>
			<view class="stat-divider"></view>
			<view class="stat">
				<view class="stat-value">{{ stats.hugs }}</view>
				<view class="stat-label">收到的抱抱</view>
			</view>
			<view class="stat-divider"></view>
			<view class="stat">
				<view class="stat-value">{{ stats.bookmarks }}</view>
				<view class="stat-label">收藏</view>
			</view>
			<view class="stat-divider"></view>
			<view class="stat">
				<view class="stat-value">{{ stats.read }}</view>
				<view class="stat-label">已读</view>
			</view>
		</view>

		<view class="group">
			<view class="row" @click="goBookmarks">
				<text>我的收藏</text>
				<text class="arrow">›</text>
			</view>
			<view class="row" @click="goHelp">
				<text>求助资源</text>
				<text class="arrow">›</text>
			</view>
			<view class="row" @click="goAbout">
				<text>关于与免责声明</text>
				<text class="arrow">›</text>
			</view>
		</view>

		<view class="section">
			<view class="section-title">我写过的</view>
			<view v-if="!myPosts.length" class="empty">
				还没有写过。想写的时候，随时都可以。
			</view>
			<view v-for="post in myPosts" :key="post.id" class="my-post" hover-class="my-post-hover" @click="openPost(post)">
				<view class="my-post-text">{{ post.text }}</view>
				<view class="my-post-meta">
					<view class="my-mood" :style="{ background: moodMeta(post.mood).bg, color: moodMeta(post.mood).fg }">{{ post.moodLabel || moodMeta(post.mood).label }}</view>
					<text>{{ timeText(post.at) }}</text>
					<text class="meta-dot">·</text>
					<text>{{ postHugCount(post) }} 个抱抱</text>
					<text v-if="post.pending" class="tag">待同步</text>
					<text v-else-if="post.reviewing" class="tag">审核中</text>
				</view>
			</view>
			<view v-if="myHasMore" class="more" @click="loadMore">加载更多</view>
		</view>

		<view class="section">
			<view class="section-title">数据</view>
			<view class="group">
				<view class="row" @click="exportData">
					<text>导出 JSON</text>
					<text class="arrow">›</text>
				</view>
				<view class="row danger" @click="clearLocalAction">
					<text>清空本机数据</text>
					<text class="arrow">›</text>
				</view>
			</view>
			<view class="note">帖子会同步到云端并公开可见；昵称、收藏、已读只存在这台设备，不上传。未登录也能发布，删除权限记录在本机，清空本机数据后便无法再管理这些帖子。</view>
		</view>

		<view v-if="renaming" class="mask" @click="cancelRename">
			<view class="dialog" @click.stop>
				<view class="dialog-title">换一个名字</view>
				<view class="dialog-field">
					<input
						class="dialog-input"
						v-model="nameInput"
						:maxlength="12"
						placeholder="最多 12 个字"
						placeholder-class="placeholder"
						focus
					/>
				</view>
				<view class="dialog-actions">
					<view class="dialog-btn ghost" @click="cancelRename">取消</view>
					<view class="dialog-btn primary" @click="confirmRename">保存</view>
				</view>
			</view>
		</view>
	</view>
	</glass-shell>
</template>

<script>
	import { formatTime } from '@/common/util.js'
	import { moodOf } from '@/common/moods.js'
	import {
		ensure,
		getProfile,
		renameProfile,
		getLocalStats,
		getPending,
		getCachedPosts,
		clearAll,
		exportJSON,
		hugCount
	} from '@/common/store.js'
	import { api, isLoggedIn, goLogin } from '@/common/api.js'
	import { mutations } from '@/uni_modules/uni-id-pages/common/store.js'

	export default {
		data() {
			return {
				profile: { name: '', since: Date.now() },
				loggedIn: false,
				stats: { posts: 0, hugs: 0, bookmarks: 0, read: 0 },
				myPosts: [],
				myCursor: 0,
				myHasMore: false,
				pending: [],
				renaming: false,
				nameInput: ''
			}
		},
		computed: {
			initial() {
				return (this.profile.name || '缓').slice(0, 1)
			}
		},
		onShow() {
			this.load()
		},
		onReachBottom() {
			if (this.myHasMore) this.loadMore()
		},
		methods: {
			load() {
				ensure()
				this.profile = getProfile()
				this.loggedIn = isLoggedIn()
				const local = getLocalStats()
				this.stats = { posts: 0, hugs: 0, bookmarks: local.bookmarks, read: local.read }
				this.myCursor = 0
				this.myHasMore = false
				this.loadPending()
				this.myPosts = this.pending || []
				this.fetchMine(true)
				this.fetchStats()
			},
			loadPending() {
				this.pending = getPending().posts.map(item => ({
					id: item.localId,
					mood: item.mood,
					text: item.text,
					at: item.at,
					hugCount: 0,
					isMine: true,
					pending: true
				}))
			},
			async fetchMine(reset) {
				try {
					const res = await api.myPosts({
						cursor: reset ? 0 : this.myCursor,
						limit: 20
					})
					const list = (res.list || []).slice()
					this.myCursor = res.cursor || 0
					this.myHasMore = !!res.hasMore
					if (reset) {
						this.myPosts = (this.pending || []).concat(list)
					} else {
						this.myPosts = this.myPosts.concat(list)
					}
				} catch (error) {
					this.myPosts = (this.pending || []).concat(getCachedPosts().filter(post => post.isMine && !post.pending))
				}
			},
			async fetchStats() {
				try {
					const res = await api.myStats()
					this.stats.posts = (res.posts || 0) + (this.pending ? this.pending.length : 0)
					this.stats.hugs = res.hugs || 0
				} catch (error) {
					const cached = getCachedPosts().filter(post => post.isMine && !post.pending)
					this.stats.posts = cached.length + (this.pending ? this.pending.length : 0)
					this.stats.hugs = cached.reduce((total, post) => total + (post.hugCount || 0), 0)
				}
			},
			loadMore() {
				this.fetchMine(false)
			},
			timeText(ts) {
				return formatTime(ts)
			},
			moodMeta(id) {
				return moodOf(id)
			},
			postHugCount(post) {
				return hugCount(post)
			},
			openPost(post) {
				uni.navigateTo({ url: '/pages/post/post?id=' + post.id })
			},
			openRename() {
				this.nameInput = this.profile.name
				this.renaming = true
			},
			cancelRename() {
				this.renaming = false
			},
			confirmRename() {
				renameProfile(this.nameInput)
				this.renaming = false
				this.load()
			},
			toLogin() {
				goLogin()
			},
			logout() {
				mutations.logout()
				this.load()
				uni.showToast({ title: '已退出登录', icon: 'none' })
				// uni-id 的 logout 会自己 redirectTo 到登录页，这里再拉回首页
				const home = () => uni.reLaunch({ url: '/pages/index/index' })
				setTimeout(home, 400)
				setTimeout(() => {
					const pages = getCurrentPages()
					const route = pages.length ? pages[pages.length - 1].route : ''
					if (route.indexOf('login') > -1) home()
				}, 1200)
			},
			goBookmarks() {
				uni.setStorageSync('huanhuan.openBookmarks', 1)
				uni.switchTab({ url: '/pages/articles/articles' })
			},
			goHelp() {
				uni.navigateTo({ url: '/pages/help/help' })
			},
			goAbout() {
				uni.navigateTo({ url: '/pages/about/about' })
			},
			exportData() {
				uni.setClipboardData({
					data: exportJSON(),
					success() {
						uni.showToast({ title: '已复制到剪贴板', icon: 'none' })
					},
					fail() {
						uni.showToast({ title: '导出失败，请重试', icon: 'none' })
					}
				})
			},
			clearLocalAction() {
				uni.showModal({
					title: '清空本机数据',
					content: '昵称、收藏、已读和本地缓存会被清空，云端帖子仍保留。',
					confirmText: '清空',
					confirmColor: '#BE8567',
					success: res => {
						if (!res.confirm) return
						clearAll()
						this.load()
					}
				})
			}
		}
	}
</script>

<style scoped>
	.page {
		min-height: 100vh;
		padding: 32rpx 32rpx 180rpx;
	}

	.profile {
		display: flex;
		align-items: center;
		padding: 20rpx 8rpx 32rpx;
	}

	.avatar {
		width: 104rpx;
		height: 104rpx;
		line-height: 104rpx;
		text-align: center;
		border-radius: 52rpx;
		background: linear-gradient(150deg, #5D7C8C 0%, #3E5B69 100%);
		border: 1px solid rgba(255, 255, 255, 0.55);
		color: #FFFFFF;
		font-size: 40rpx;
		font-weight: 600;
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35), 0 10rpx 24rpx rgba(62, 91, 105, 0.26);
	}

	.profile-main {
		margin-left: 24rpx;
		flex: 1;
	}

	.name-row {
		display: flex;
		align-items: center;
	}

	.name {
		font-size: 36rpx;
		font-weight: 600;
		color: #2A2723;
	}

	.rename {
		margin-left: 18rpx;
		padding: 8rpx 20rpx;
		border-radius: 22rpx;
		background: rgba(255, 255, 255, 0.5);
		border: 1px solid rgba(255, 255, 255, 0.75);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85);
		font-size: 22rpx;
		color: #5F5A52;
	}

	.since {
		margin-top: 10rpx;
		font-size: 24rpx;
		color: #5F5A52;
	}

	.logout {
		font-size: 25rpx;
		color: #5F5A52;
	}

	.login-card {
		margin-bottom: 24rpx;
		padding: 30rpx;
		border-radius: 30rpx;
		background:
			radial-gradient(120% 90% at 100% 0%, rgba(190, 133, 103, 0.16) 0%, rgba(190, 133, 103, 0) 60%),
			linear-gradient(165deg, rgba(255, 255, 255, 0.56) 0%, rgba(255, 255, 255, 0.36) 100%);
		border: 1px solid rgba(255, 255, 255, 0.8);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 12rpx 30rpx rgba(74, 64, 54, 0.07);
		-webkit-backdrop-filter: blur(18px) saturate(160%);
		backdrop-filter: blur(18px) saturate(160%);
	}

	.login-card-title {
		font-size: 30rpx;
		font-weight: 600;
		color: #6E4E3C;
	}

	.login-card-text {
		margin-top: 10rpx;
		font-size: 25rpx;
		line-height: 1.7;
		color: #5F5A52;
	}

	.login-card-btn {
		margin-top: 20rpx;
		display: inline-block;
		padding: 0 32rpx;
		height: 76rpx;
		line-height: 76rpx;
		border-radius: 38rpx;
		background: #9C6A4E;
		font-size: 26rpx;
		color: #FFFFFF;
		box-shadow: 0 8rpx 20rpx rgba(156, 106, 78, 0.24);
	}

	.stats {
		display: flex;
		align-items: center;
		padding: 30rpx 12rpx;
		border-radius: 30rpx;
		background:
			radial-gradient(120% 90% at 100% 0%, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0) 58%),
			linear-gradient(165deg, rgba(255, 255, 255, 0.54) 0%, rgba(255, 255, 255, 0.34) 100%);
		border: 1px solid rgba(255, 255, 255, 0.8);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.95),
			0 0 0 1px rgba(120, 110, 98, 0.045),
			0 12rpx 30rpx rgba(74, 64, 54, 0.08);
		-webkit-backdrop-filter: blur(18px) saturate(160%);
		backdrop-filter: blur(18px) saturate(160%);
	}

	.stat {
		flex: 1;
		text-align: center;
	}

	.stat-divider {
		width: 1rpx;
		height: 44rpx;
		background: rgba(120, 110, 98, 0.14);
	}

	.stat-value {
		font-size: 34rpx;
		font-weight: 600;
		color: #2A2723;
	}

	.stat-label {
		margin-top: 8rpx;
		font-size: 22rpx;
		color: #5F5A52;
	}

	.group {
		margin-top: 24rpx;
		border-radius: 30rpx;
		overflow: hidden;
		background:
			radial-gradient(120% 90% at 100% 0%, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0) 58%),
			linear-gradient(165deg, rgba(255, 255, 255, 0.54) 0%, rgba(255, 255, 255, 0.34) 100%);
		border: 1px solid rgba(255, 255, 255, 0.8);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.95),
			0 0 0 1px rgba(120, 110, 98, 0.045),
			0 12rpx 30rpx rgba(74, 64, 54, 0.08);
		-webkit-backdrop-filter: blur(18px) saturate(160%);
		backdrop-filter: blur(18px) saturate(160%);
	}

	.row {
		display: flex;
		align-items: center;
		padding: 0 32rpx;
		height: 100rpx;
		font-size: 29rpx;
		color: #2A2723;
		border-bottom: 1px solid rgba(255, 255, 255, 0.6);
	}

	.row:last-child {
		border-bottom: none;
	}

	.row.danger {
		color: #8A5A3C;
	}

	.arrow {
		margin-left: auto;
		color: #5F5A52;
		font-size: 34rpx;
	}

	.section {
		margin-top: 40rpx;
	}

	.section-title {
		margin-bottom: 20rpx;
		font-size: 26rpx;
		color: #5F5A52;
	}

	.my-post {
		margin-bottom: 18rpx;
		padding: 26rpx 28rpx;
		border-radius: 26rpx;
		background:
			radial-gradient(120% 90% at 100% 0%, rgba(255, 255, 255, 0.46) 0%, rgba(255, 255, 255, 0) 58%),
			linear-gradient(165deg, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0.32) 100%);
		border: 1px solid rgba(255, 255, 255, 0.78);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 10rpx 26rpx rgba(74, 64, 54, 0.06);
		-webkit-backdrop-filter: blur(16px) saturate(150%);
		backdrop-filter: blur(16px) saturate(150%);
		transition: transform 0.12s ease;
	}

	.my-post-hover {
		transform: scale(0.988);
	}

	.my-post-text {
		font-size: 28rpx;
		line-height: 1.7;
		color: #2A2723;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		overflow: hidden;
	}

	.my-post-meta {
		margin-top: 14rpx;
		display: flex;
		align-items: center;
		font-size: 22rpx;
		color: #5F5A52;
	}

	.my-mood {
		margin-right: 14rpx;
		padding: 2rpx 14rpx;
		border-radius: 14rpx;
		border: 1px solid rgba(255, 255, 255, 0.5);
		font-size: 20rpx;
	}

	.meta-dot {
		margin: 0 8rpx;
	}

	.tag {
		margin-left: 12rpx;
		padding: 2rpx 12rpx;
		border-radius: 12rpx;
		background: rgba(255, 255, 255, 0.55);
		border: 1px solid rgba(255, 255, 255, 0.7);
		color: #5F5A52;
	}

	.empty {
		padding: 34rpx;
		border-radius: 26rpx;
		background: rgba(255, 255, 255, 0.42);
		border: 1px solid rgba(255, 255, 255, 0.75);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
		font-size: 26rpx;
		color: #5F5A52;
	}

	.more {
		padding: 24rpx;
		text-align: center;
		font-size: 25rpx;
		color: #3E5B69;
	}

	.note {
		margin-top: 18rpx;
		font-size: 23rpx;
		line-height: 1.7;
		color: #5F5A52;
	}

	.mask {
		position: fixed;
		left: 0;
		top: 0;
		right: 0;
		bottom: 0;
		background: rgba(38, 36, 33, 0.36);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.dialog {
		width: 600rpx;
		padding: 40rpx;
		border-radius: 32rpx;
		background: rgba(255, 255, 255, 0.86);
		border: 1px solid rgba(255, 255, 255, 0.9);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 1), 0 24rpx 60rpx rgba(60, 52, 44, 0.22);
		-webkit-backdrop-filter: blur(26px) saturate(160%);
		backdrop-filter: blur(26px) saturate(160%);
	}

	.dialog-title {
		font-size: 32rpx;
		font-weight: 600;
		color: #2A2723;
	}

	.dialog-field {
		margin-top: 28rpx;
		padding: 0 28rpx;
		height: 88rpx;
		display: flex;
		align-items: center;
		border-radius: 20rpx;
		background: rgba(255, 255, 255, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.85);
	}

	.dialog-input {
		width: 100%;
		height: 88rpx;
		font-size: 28rpx;
		color: #2A2723;
	}

	.placeholder {
		color: #5F5A52;
	}

	.dialog-actions {
		margin-top: 32rpx;
		display: flex;
	}

	.dialog-btn {
		flex: 1;
		height: 88rpx;
		line-height: 88rpx;
		text-align: center;
		border-radius: 44rpx;
		font-size: 28rpx;
	}

	.dialog-btn.ghost {
		margin-right: 18rpx;
		background: rgba(255, 255, 255, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.85);
		color: #5F5A52;
	}

	.dialog-btn.primary {
		background: #3E5B69;
		color: #FFFFFF;
		box-shadow: 0 8rpx 20rpx rgba(62, 91, 105, 0.24);
	}
</style>
