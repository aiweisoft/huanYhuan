<template>
	<glass-shell>
	<view class="page">
		<view class="intro">
			<view class="intro-sub">不催你好起来，只帮你看清楚一点。</view>
		</view>

		<view class="search">
			<input
				class="search-input"
				v-model="keyword"
				placeholder="搜一个词，比如 失眠"
				placeholder-class="placeholder"
				confirm-type="search"
			/>
			<view v-if="keyword" class="search-clear" @click="keyword = ''">×</view>
		</view>

		<view class="filters-wrap">
			<scroll-view class="filters" scroll-x :show-scrollbar="false">
				<view class="chips">
					<view
						v-for="item in categories"
						:key="item"
						class="chip"
						:class="{ active: category === item }"
						@click="category = item"
					>{{ item }}</view>
					<view class="chip bookmark-chip" :class="{ active: onlyBookmark }" @click="onlyBookmark = !onlyBookmark">只看收藏</view>
				</view>
			</scroll-view>
		</view>

		<view class="list">
			<view v-for="item in list" :key="item.id" class="article" hover-class="article-hover" hover-stay-time="80" @click="open(item)">
				<view class="article-head">
					<view class="category">{{ item.category }}</view>
					<view class="head-side">
						<view class="read" v-if="readSet.includes(item.id)">已读</view>
						<view class="saved" v-if="bookmarkSet.includes(item.id)">收藏</view>
						<view class="minutes">阅读约 {{ item.minutes || 3 }} 分钟</view>
					</view>
				</view>
				<view class="title">{{ item.title }}</view>
				<view class="summary">{{ item.summary }}</view>
				<view class="meta">
					<text class="meta-item">{{ item.source }}</text>
					<text v-if="updatedText(item)" class="meta-item"><text class="dot">·</text>{{ updatedText(item) }}</text>
				</view>
			</view>

			<view v-if="!list.length" class="empty">
				<view class="empty-title">没有找到</view>
				<view class="empty-text">换个词，或者取消「只看收藏」再看看。</view>
				<view v-if="hasFilter" class="empty-action" @click="resetFilters">清除筛选，浏览全部</view>
			</view>
		</view>
	</view>
	</glass-shell>
</template>

<script>
	import { getArticleList, refreshArticleList, articleCategories } from '@/common/articles.js'
	import { ensure, isBookmarked, isRead } from '@/common/store.js'
	import { formatDate } from '@/common/util.js'

	export default {
		data() {
			return {
				articles: [],
				categories: ['全部'],
				keyword: '',
				category: '全部',
				onlyBookmark: false,
				readSet: [],
				bookmarkSet: []
			}
		},
		computed: {
			list() {
				const keyword = this.keyword.trim()
				return this.articles.filter(item => {
					if (this.category !== '全部' && item.category !== this.category) return false
					if (this.onlyBookmark && !this.bookmarkSet.includes(item.id)) return false
					if (!keyword) return true
					const text = item.title + '\n' + (item.body || []).join('\n')
					return text.includes(keyword)
				})
			},
			hasFilter() {
				return !!this.keyword.trim() || this.onlyBookmark || this.category !== '全部'
			}
		},
		onShow() {
			this.sync()
			this.load()
			if (uni.getStorageSync('huanhuan.openBookmarks')) {
				uni.removeStorageSync('huanhuan.openBookmarks')
				this.onlyBookmark = true
			}
		},
		onPullDownRefresh() {
			// 兜底：网络请求异常时也要把下拉状态收掉，避免指示器一直转
			const timer = setTimeout(() => uni.stopPullDownRefresh(), 8000)
			this.load().finally(() => {
				clearTimeout(timer)
				uni.stopPullDownRefresh()
			})
		},
		methods: {
			updatedText(item) {
				const ts = (item && (item.updatedAt || item.at)) || 0
				return ts ? '更新于 ' + formatDate(ts) : ''
			},
			async load() {
				this.articles = getArticleList()
				this.categories = articleCategories(this.articles)
				const list = await refreshArticleList()
				this.articles = list
				this.categories = articleCategories(list)
				if (this.category !== '全部' && this.categories.indexOf(this.category) === -1) {
					this.category = '全部'
				}
			},
			sync() {
				const state = ensure()
				this.readSet = state.readIds.slice()
				this.bookmarkSet = state.bookmarks.slice()
			},
			open(item) {
				uni.navigateTo({ url: '/pages/article/article?id=' + item.id })
			},
			resetFilters() {
				this.keyword = ''
				this.category = '全部'
				this.onlyBookmark = false
			}
		}
	}
</script>

<style scoped>
	.page {
		min-height: 100vh;
		padding: 24rpx 32rpx 180rpx;
	}

	.intro {
		padding: 16rpx 8rpx 24rpx;
	}

	.intro-title {
		font-size: 46rpx;
		font-weight: 600;
		color: #2A2723;
		letter-spacing: 2rpx;
	}

	.intro-sub {
		margin-top: 12rpx;
		font-size: 27rpx;
		color: #5F5A52;
	}

	.search {
		margin-bottom: 20rpx;
		padding: 0 24rpx;
		height: 72rpx;
		display: flex;
		align-items: center;
		border-radius: 36rpx;
		background: rgba(255, 255, 255, 0.46);
		border: 1px solid rgba(255, 255, 255, 0.75);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 6rpx 18rpx rgba(74, 64, 54, 0.06);
		-webkit-backdrop-filter: blur(12px) saturate(150%);
		backdrop-filter: blur(12px) saturate(150%);
	}

	.search-input {
		flex: 1;
		width: 100%;
		height: 72rpx;
		font-size: 26rpx;
		color: #2A2723;
	}

	.search-clear {
		flex-shrink: 0;
		margin-left: 12rpx;
		width: 44rpx;
		height: 44rpx;
		line-height: 40rpx;
		text-align: center;
		border-radius: 22rpx;
		background: rgba(255, 255, 255, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.8);
		font-size: 26rpx;
		color: #5F5A52;
	}

	.placeholder {
		color: #5F5A52;
	}

	.filters-wrap {
		position: relative;
		margin-bottom: 26rpx;
	}

	.filters {
		white-space: nowrap;
	}

	.chips {
		display: inline-flex;
		padding-right: 20rpx;
	}

	.chip {
		margin-right: 16rpx;
		padding: 0 26rpx;
		height: 72rpx;
		line-height: 70rpx;
		border-radius: 36rpx;
		background: rgba(255, 255, 255, 0.5);
		border: 1px solid rgba(255, 255, 255, 0.72);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85), 0 3rpx 10rpx rgba(74, 64, 54, 0.045);
		font-size: 25rpx;
		color: #4A453E;
	}

	.chip.active {
		background: #3E5B69;
		border-color: rgba(62, 91, 105, 0.9);
		box-shadow: 0 8rpx 20rpx rgba(62, 91, 105, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.22);
		color: #FFFFFF;
	}

	.bookmark-chip.active {
		background: #9C6A4E;
		border-color: rgba(156, 106, 78, 0.9);
		box-shadow: 0 8rpx 20rpx rgba(156, 106, 78, 0.22);
	}

	.article {
		position: relative;
		margin-bottom: 20rpx;
		padding: 30rpx 28rpx 26rpx;
		border-radius: 30rpx;
		background:
			radial-gradient(120% 90% at 100% 0%, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0) 58%),
			linear-gradient(165deg, rgba(255, 255, 255, 0.54) 0%, rgba(255, 255, 255, 0.34) 100%);
		border: 1px solid rgba(255, 255, 255, 0.8);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.95),
			inset 0 -1px 0 rgba(255, 255, 255, 0.3),
			0 0 0 1px rgba(120, 110, 98, 0.045),
			0 12rpx 30rpx rgba(74, 64, 54, 0.08),
			0 2rpx 6rpx rgba(74, 64, 54, 0.04);
		-webkit-backdrop-filter: blur(18px) saturate(160%);
		backdrop-filter: blur(18px) saturate(160%);
		transition: transform 0.12s ease;
	}

	.article:active {
		transform: scale(0.99);
	}

	.article-hover {
		transform: scale(0.99);
	}

	.article-head {
		display: flex;
		align-items: center;
		font-size: 22rpx;
	}

	.category {
		padding: 4rpx 16rpx;
		border-radius: 16rpx;
		background: rgba(255, 255, 255, 0.55);
		border: 1px solid rgba(255, 255, 255, 0.7);
		color: #5F5A52;
	}

	.head-side {
		margin-left: auto;
		display: flex;
		align-items: center;
		color: #5F5A52;
	}

	.head-side .read,
	.head-side .saved,
	.head-side .minutes {
		margin-left: 14rpx;
	}

	.read {
		padding: 2rpx 12rpx;
		border-radius: 12rpx;
		background: rgba(62, 91, 105, 0.14);
		color: #3E5B69;
		font-weight: 600;
	}

	.saved {
		color: #8A5A3C;
	}

	.minutes {
		color: #5F5A52;
	}

	.title {
		margin-top: 18rpx;
		font-size: 33rpx;
		font-weight: 600;
		line-height: 1.5;
		color: #2A2723;
	}

	.summary {
		margin-top: 12rpx;
		font-size: 26rpx;
		line-height: 1.7;
		color: #5F5A52;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		margin-top: 18rpx;
		font-size: 23rpx;
		color: #5F5A52;
	}

	.meta text {
		white-space: nowrap;
	}

	.meta-item {
		white-space: nowrap;
	}

	.dot {
		margin: 0 10rpx;
	}

	.empty {
		margin-top: 120rpx;
		text-align: center;
	}

	.empty-title {
		font-size: 32rpx;
		color: #3A3630;
	}

	.empty-text {
		margin-top: 16rpx;
		font-size: 26rpx;
		color: #5F5A52;
	}

	.empty-action {
		display: inline-block;
		margin-top: 32rpx;
		padding: 0 36rpx;
		height: 80rpx;
		line-height: 78rpx;
		border-radius: 40rpx;
		background: rgba(255, 255, 255, 0.5);
		border: 1px solid rgba(255, 255, 255, 0.75);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
		font-size: 26rpx;
		color: #3E5B69;
	}
</style>
