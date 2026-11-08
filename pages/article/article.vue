<template>
	<glass-shell>
	<view class="page">
		<view v-if="!article" class="missing">
			<view class="missing-title">{{ loading ? '正在打开…' : '文章不存在' }}</view>
			<view class="missing-text" v-if="!loading">它可能已经被移除。</view>
		</view>

		<template v-else>
			<view class="head">
				<view class="head-top">
					<view class="category">{{ article.category }}</view>
					<view class="minutes">阅读约 {{ article.minutes || 3 }} 分钟</view>
				</view>
				<view class="title">{{ article.title }}</view>
				<view class="meta">
					<text class="meta-item">{{ article.source }}</text>
					<text v-if="updatedText" class="meta-item"><text class="dot">·</text>{{ updatedText }}</text>
				</view>
			</view>

			<view class="toolbar">
				<view class="font-group">
					<view
						v-for="item in fontOptions"
						:key="item.value"
						class="font-btn"
						:class="{ active: fontSize === item.value }"
						@click="changeFont(item.value)"
					>{{ item.label }}</view>
				</view>
				<view class="speak" :class="{ active: speaking }" @click="toggleSpeak">{{ speaking ? '停止' : '朗读' }}</view>
				<view class="save" :class="{ active: saved }" @click="toggleSave">{{ saved ? '已收藏' : '收藏' }}</view>
			</view>

			<view class="content" :style="{ fontSize: contentSize, lineHeight: contentLineHeight }">
				<view v-for="(paragraph, index) in article.body" :key="index" class="paragraph">{{ paragraph }}</view>
			</view>

			<view v-if="article.url" class="origin" @click="openOrigin">查看原文</view>

			<crisis-card v-if="showCrisis" />

			<view class="disclaimer">
				本文用于情绪科普与自我理解，不构成诊断或治疗建议。如果困扰持续影响生活，请寻求专业帮助。
			</view>
		</template>
	</view>
	</glass-shell>
</template>

<script>
	import crisisCard from '@/components/crisis-card.vue'
	import { getArticleSync, loadArticle } from '@/common/articles.js'
	import { ensure, isBookmarked, toggleBookmark, markRead, getFontSize, setFontSize } from '@/common/store.js'
	import { detectCrisis } from '@/common/crisis.js'
	import { formatDate, openExternal } from '@/common/util.js'
	import { canSpeak, speak, stopSpeak } from '@/common/tts.js'

	const FONT_MAP = {
		small: { size: '28rpx', line: '1.8' },
		normal: { size: '31rpx', line: '1.85' },
		large: { size: '35rpx', line: '1.95' }
	}

	export default {
		components: { crisisCard },
		data() {
			return {
				id: '',
				article: null,
				loading: true,
				saved: false,
				speaking: false,
				fontSize: 'normal',
				fontOptions: [
					{ value: 'small', label: '小' },
					{ value: 'normal', label: '中' },
					{ value: 'large', label: '大' }
				]
			}
		},
		computed: {
			updatedText() {
				const item = this.article
				if (!item) return ''
				const ts = item.updatedAt || item.at || 0
				return ts ? '更新于 ' + formatDate(ts) : ''
			},
			contentSize() {
				return (FONT_MAP[this.fontSize] || FONT_MAP.normal).size
			},
			contentLineHeight() {
				return (FONT_MAP[this.fontSize] || FONT_MAP.normal).line
			},
			showCrisis() {
				if (!this.article) return false
				return detectCrisis((this.article.body || []).join('\n'))
			}
		},
		onLoad(options) {
			this.id = options.id || ''
			this.article = getArticleSync(this.id)
			this.fontSize = getFontSize()
			if (this.article) this.applyArticle()
			ensure()
			this.fetchArticle()
		},
		onHide() {
			stopSpeak()
			this.speaking = false
		},
		onUnload() {
			stopSpeak()
			this.speaking = false
		},
		methods: {
			async fetchArticle() {
				try {
					const article = await loadArticle(this.id)
					if (article) {
						this.article = article
						this.applyArticle()
					}
				} finally {
					this.loading = false
				}
			},
			applyArticle() {
				if (!this.article) return
				uni.setNavigationBarTitle({ title: this.article.category || '文章详情' })
				markRead(this.article.id)
				this.saved = isBookmarked(this.article.id)
			},
			changeFont(value) {
				this.fontSize = value
				setFontSize(value)
			},
			toggleSpeak() {
				if (this.speaking) {
					stopSpeak()
					this.speaking = false
					return
				}
				if (!this.article) return
				if (!canSpeak()) {
					uni.showToast({ title: '当前环境不支持朗读', icon: 'none' })
					return
				}
				const text = [this.article.title].concat(this.article.body || []).join('。')
				const ok = speak(text, {
					onEnd: () => {
						this.speaking = false
					},
					onError: () => {
						this.speaking = false
						uni.showToast({ title: '朗读启动失败，检查系统语音引擎', icon: 'none' })
					}
				})
				if (ok) {
					this.speaking = true
				} else {
					uni.showToast({ title: '当前环境不支持朗读', icon: 'none' })
				}
			},
			toggleSave() {
				if (!this.article) return
				this.saved = toggleBookmark(this.article.id)
				uni.showToast({
					title: this.saved ? '已收藏' : '已取消收藏',
					icon: 'none'
				})
			},
			openOrigin() {
				openExternal(this.article.url)
			}
		}
	}
</script>

<style scoped>
	.page {
		min-height: 100vh;
		padding: 32rpx 36rpx 100rpx;
	}

	.head-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.minutes {
		font-size: 23rpx;
		color: #5F5A52;
	}

	.category {
		display: inline-block;
		padding: 6rpx 18rpx;
		border-radius: 18rpx;
		background: rgba(255, 255, 255, 0.55);
		border: 1px solid rgba(255, 255, 255, 0.75);
		font-size: 23rpx;
		color: #5F5A52;
	}

	.title {
		margin-top: 22rpx;
		font-size: 42rpx;
		font-weight: 600;
		line-height: 1.45;
		color: #2A2723;
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

	.toolbar {
		margin-top: 32rpx;
		padding: 12rpx 16rpx;
		display: flex;
		align-items: center;
		border-radius: 34rpx;
		background: rgba(255, 255, 255, 0.46);
		border: 1px solid rgba(255, 255, 255, 0.75);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 6rpx 18rpx rgba(74, 64, 54, 0.06);
		-webkit-backdrop-filter: blur(14px) saturate(150%);
		backdrop-filter: blur(14px) saturate(150%);
	}

	.font-group {
		display: flex;
		padding: 6rpx;
		border-radius: 34rpx;
		background: rgba(255, 255, 255, 0.35);
	}

	.font-btn {
		width: 72rpx;
		height: 64rpx;
		line-height: 64rpx;
		text-align: center;
		border-radius: 32rpx;
		font-size: 25rpx;
		color: #5F5A52;
	}

	.font-btn.active {
		background: rgba(255, 255, 255, 0.92);
		box-shadow: 0 2rpx 8rpx rgba(74, 64, 54, 0.08);
		color: #3E5B69;
		font-weight: 600;
	}

	.speak {
		margin-left: auto;
		padding: 0 24rpx;
		height: 64rpx;
		line-height: 62rpx;
		border-radius: 32rpx;
		border: 1px solid rgba(62, 91, 105, 0.4);
		background: rgba(255, 255, 255, 0.3);
		font-size: 25rpx;
		color: #3E5B69;
	}

	.speak.active {
		border-color: rgba(62, 91, 105, 0.95);
		background: #3E5B69;
		color: #FFFFFF;
		font-weight: 500;
	}

	.save {
		margin-left: 14rpx;
		padding: 0 26rpx;
		height: 64rpx;
		line-height: 62rpx;
		border-radius: 32rpx;
		border: 1px solid rgba(190, 133, 103, 0.45);
		background: rgba(255, 255, 255, 0.3);
		font-size: 25rpx;
		color: #8A5A3C;
	}

	.save.active {
		border-color: rgba(156, 106, 78, 0.9);
		background: #9C6A4E;
		color: #FFFFFF;
		font-weight: 500;
	}

	.content {
		margin-top: 36rpx;
		color: #24211E;
	}

	.paragraph {
		margin-bottom: 28rpx;
		text-align: justify;
	}

	.origin {
		margin-top: 12rpx;
		padding: 28rpx;
		text-align: center;
		border-radius: 26rpx;
		background: rgba(255, 255, 255, 0.46);
		border: 1px solid rgba(255, 255, 255, 0.75);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
		font-size: 27rpx;
		color: #3E5B69;
	}

	.disclaimer {
		margin-top: 36rpx;
		padding: 28rpx;
		border-radius: 26rpx;
		background: rgba(255, 255, 255, 0.4);
		border: 1px solid rgba(255, 255, 255, 0.72);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85);
		font-size: 24rpx;
		line-height: 1.8;
		color: #5F5A52;
	}

	.missing {
		margin-top: 160rpx;
		text-align: center;
	}

	.missing-title {
		font-size: 32rpx;
		color: #3A3630;
	}

	.missing-text {
		margin-top: 16rpx;
		font-size: 26rpx;
		color: #5F5A52;
	}
</style>
