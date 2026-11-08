<template>
	<glass-shell>
	<view class="page">
		<view class="body">
			<view class="intro">
				<view class="intro-date"></view>
				<view class="intro-lead">{{ todayText }}，不用急着好起来，先待一会儿，缓一缓。</view>
			</view>

			<view v-if="!loggedIn" class="login-line" @click="toLogin">
				<text class="login-text">登录后可以抱一抱别人</text>
				<text class="login-link">去登录 ›</text>
			</view>

			<scroll-view class="cats" scroll-x :show-scrollbar="false">
				<view class="cat-row">
					<view class="cat" :class="{ on: filter === 'all' }" @click="changeFilter('all')">全部</view>
					<view
						v-for="item in moods"
						:key="item.id"
						class="cat"
						:class="{ on: filter === item.id }"
						@click="changeFilter(item.id)"
					>{{ item.label }}</view>
				</view>
			</scroll-view>

			<view class="list">
				<post-card
					v-for="post in posts"
					:key="post.id"
					:post="post"
					@open="openPost"
					@hug="onHug"
				/>

				<view v-if="loading && !posts.length" class="state">正在捞上来的路上…</view>

				<view v-if="!posts.length && !loading" class="state empty">
					<view class="state-title">这里还很安静</view>
					<view class="state-text">要不要先写一句？没人会追问你是谁。</view>
					<view class="empty-btn" @click="compose">写第一句</view>
				</view>

				<view class="list-end" v-if="posts.length && !hasMore">没有更多了，去写一点自己的吧。</view>
				<view class="list-end" v-if="posts.length && hasMore">上滑看看更早的</view>
			</view>

			<view class="fab" hover-class="fab-hover" @click="compose">+</view>
		</view>
	</view>
	</glass-shell>
</template>

<script>
	import postCard from '@/components/post-card.vue'
	import { MOODS } from '@/common/moods.js'
	import { getCachedPosts, mergeCachedPosts, replaceCachedPosts, upsertCachedPost, addPendingHug } from '@/common/store.js'
	import { api, isLoggedIn, goLogin, requireLogin, isNetworkError } from '@/common/api.js'

	export default {
		components: { postCard },
		data() {
			return {
				moods: MOODS,
				filter: 'all',
				posts: [],
				cursor: 0,
				hasMore: true,
				loading: false,
				loggedIn: false
			}
		},
		computed: {
			todayText() {
				const d = new Date()
				return (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日'
			}
		},
		onShow() {
			this.loggedIn = isLoggedIn()
			let shouldReset = false
			try {
				if (uni.getStorageSync('huanhuan.resetFilter')) {
					uni.removeStorageSync('huanhuan.resetFilter')
					shouldReset = true
				}
			} catch (e) {
				shouldReset = false
			}
			if (shouldReset) {
				this.filter = 'all'
				this.cursor = 0
				this.hasMore = true
			}
			this.posts = getCachedPosts(this.filter)
			this.fetch(true)
		},
		onPullDownRefresh() {
			this.fetch(true).then(() => uni.stopPullDownRefresh()).catch(() => uni.stopPullDownRefresh())
		},
		onReachBottom() {
			if (this.hasMore && !this.loading) this.fetch(false)
		},
		methods: {
			changeFilter(id) {
				this.filter = id
				this.posts = getCachedPosts(id)
				this.cursor = 0
				this.hasMore = true
				this.fetch(true)
			},
			async fetch(reset) {
				if (this.loading) return
				this.loading = true
				try {
					const res = await api.listPosts({
						mood: this.filter,
						cursor: reset ? 0 : this.cursor,
						limit: 20
					})
					if (reset) {
						replaceCachedPosts(res.list || [])
						this.posts = getCachedPosts(this.filter)
					} else {
						mergeCachedPosts(res.list || [])
						const exists = new Set(this.posts.map(post => post.id))
						const appended = (res.list || []).filter(post => !exists.has(post.id))
						this.posts = this.posts.concat(appended)
					}
					this.cursor = res.cursor || 0
					this.hasMore = !!res.hasMore
				} catch (error) {
					if (isNetworkError(error)) {
						uni.showToast({ title: '网络不好，先看缓存', icon: 'none' })
					} else if (error.code === 'NEED_LOGIN') {
						this.loggedIn = false
					} else {
						uni.showToast({ title: error.message, icon: 'none' })
					}
				} finally {
					this.loading = false
				}
			},
			async onHug(post) {
				if (!requireLogin()) return
				if (post.pending) {
					uni.showToast({ title: '这条还在等待同步', icon: 'none' })
					return
				}
				try {
					const res = await api.hug({ postId: post.id })
					if (res.ok) {
						upsertCachedPost({ ...post, hugged: true, hugCount: res.hugCount })
					}
					this.posts = getCachedPosts(this.filter)
					uni.showToast({ title: res.ok ? '抱一下收到了' : res.message, icon: 'none' })
				} catch (error) {
					if (isNetworkError(error)) {
						addPendingHug(post.id)
						upsertCachedPost({ ...post, hugged: true, hugCount: (post.hugCount || 0) + 1 })
						this.posts = getCachedPosts(this.filter)
						uni.showToast({ title: '先记下了，联网后再送达', icon: 'none' })
					} else if (error.code === 'NEED_LOGIN') {
						this.loggedIn = false
						goLogin()
					} else {
						uni.showToast({ title: error.message, icon: 'none' })
					}
				}
			},
			openPost(post) {
				uni.navigateTo({ url: '/pages/post/post?id=' + post.id })
			},
			compose() {
				uni.navigateTo({ url: '/pages/compose/compose' })
			},
			toLogin() {
				goLogin()
			}
		}
	}
</script>

<style scoped>
	.page {
		min-height: 100vh;
	}

	.body {
		padding: 24rpx 32rpx 220rpx;
	}

	.intro {
		padding: 8rpx 6rpx 20rpx;
	}

	.intro-date {
		font-size: 20rpx;
		letter-spacing: 6rpx;
		color: #5F5A52;
	}

	.intro-lead {
		margin-top: 14rpx;
		font-size: 28rpx;
		line-height: 1.7;
		color: #3A3630;
	}

	/* 细玻璃条 */
	.login-line {
		display: flex;
		align-items: center;
		height: 76rpx;
		margin-bottom: 20rpx;
		padding: 0 26rpx;
		border-radius: 38rpx;
		background: rgba(255, 255, 255, 0.46);
		border: 1px solid rgba(255, 255, 255, 0.72);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85), 0 4rpx 14rpx rgba(74, 64, 54, 0.05);
		-webkit-backdrop-filter: blur(12px) saturate(150%);
		backdrop-filter: blur(12px) saturate(150%);
	}

	.login-text {
		font-size: 23rpx;
		color: #5F5A52;
	}

	.login-link {
		margin-left: auto;
		padding-left: 24rpx;
		font-size: 23rpx;
		color: #3E5B69;
	}

	.cats {
		white-space: nowrap;
		margin-bottom: 20rpx;
	}

	.cat-row {
		display: inline-flex;
		padding: 4rpx 0 2rpx;
	}

	.cat {
		flex-shrink: 0;
		margin-right: 14rpx;
		padding: 0 26rpx;
		height: 72rpx;
		line-height: 70rpx;
		border-radius: 36rpx;
		background: rgba(255, 255, 255, 0.5);
		border: 1px solid rgba(255, 255, 255, 0.72);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85), 0 3rpx 10rpx rgba(74, 64, 54, 0.045);
		font-size: 25rpx;
		color: #4A453E;
		white-space: nowrap;
	}

	.cat.on {
		background: #3E5B69;
		border-color: rgba(62, 91, 105, 0.9);
		box-shadow: 0 8rpx 20rpx rgba(62, 91, 105, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.22);
		color: #FFFFFF;
	}

	.list {
		margin-top: 2rpx;
	}

	.state {
		padding: 32rpx 0;
		text-align: center;
		font-size: 24rpx;
		color: #5F5A52;
	}

	.state.empty {
		margin-top: 8rpx;
		padding: 72rpx 36rpx;
		border-radius: 30rpx;
		background: rgba(255, 255, 255, 0.42);
		border: 1px solid rgba(255, 255, 255, 0.7);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85), 0 8rpx 24rpx rgba(74, 64, 54, 0.06);
		-webkit-backdrop-filter: blur(16px) saturate(150%);
		backdrop-filter: blur(16px) saturate(150%);
	}

	.state-title {
		font-size: 32rpx;
		font-weight: 600;
		color: #3A3630;
	}

	.state-text {
		margin-top: 14rpx;
		font-size: 25rpx;
		line-height: 1.7;
		color: #5F5A52;
	}

	.empty-btn {
		display: inline-block;
		margin-top: 32rpx;
		padding: 0 40rpx;
		height: 76rpx;
		line-height: 76rpx;
		border-radius: 38rpx;
		background: #3E5B69;
		font-size: 26rpx;
		color: #FFFFFF;
		box-shadow: 0 8rpx 20rpx rgba(62, 91, 105, 0.24);
	}

	.list-end {
		padding: 30rpx 0 8rpx;
		text-align: center;
		font-size: 24rpx;
		color: #5F5A52;
	}

	.fab {
		position: fixed;
		right: 40rpx;
		bottom: calc(150rpx + env(safe-area-inset-bottom));
		width: 100rpx;
		height: 100rpx;
		line-height: 96rpx;
		text-align: center;
		border-radius: 50rpx;
		background: linear-gradient(150deg, #5D7C8C 0%, #3E5B69 100%);
		color: #FFFFFF;
		font-size: 44rpx;
		box-shadow: 0 12rpx 30rpx rgba(62, 91, 105, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.35);
		transition: transform 0.15s ease;
	}

	.fab-hover {
		transform: scale(0.94);
	}
</style>
