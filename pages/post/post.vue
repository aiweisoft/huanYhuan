<template>
	<glass-shell>
	<view class="page">
		<view v-if="!post" class="missing">
			<view class="missing-title">{{ loading ? '正在打开…' : '这条已经不在了' }}</view>
			<view class="missing-text" v-if="!loading">它可能被删除，或者只存在于上一次记录里。</view>
		</view>

		<template v-else>
			<view class="card">
				<view class="head">
					<view class="mood" :style="{ background: mood.bg, color: mood.fg }">
						<view class="mood-dot" :style="{ background: mood.fg }"></view>
						<text>{{ post.moodLabel || mood.label }}</text>
					</view>
					<view class="time">{{ timeText }}</view>
					<view v-if="post.isMine" class="mine">我写的</view>
				</view>
				<view class="body">{{ post.text }}</view>
				<view class="foot">
					<view class="hug" :class="{ hugged: hugged }" hover-class="hug-hover" @click="onHug">
						<view class="hug-icon"></view>
						<text>{{ hugged ? '已抱过' : '抱一下' }}</text>
						<text class="hug-count" v-if="count">{{ count }}</text>
					</view>
				</view>
			</view>

			<view v-if="post.pending" class="tip">这条已存本机，联网后会自动同步，同步前不能收到回应。</view>
			<view v-else-if="post.reviewing" class="tip">这条正在审核中，目前只有你自己能看到。</view>

			<crisis-card v-if="showCrisis" />

			<template v-if="!post.pending">
				<view class="section">
					<view class="label">留一句善意</view>
					<view class="presets">
						<view
							v-for="item in presets"
							:key="item"
							class="preset"
							hover-class="preset-hover"
							@click="send(item)"
						>{{ item }}</view>
					</view>
					<view class="reply">
						<view class="reply-field">
							<input
								class="reply-input"
								v-model="replyText"
								:maxlength="40"
								placeholder="或者自己写一句"
								placeholder-class="placeholder"
								confirm-type="send"
								@confirm="send()"
							/>
						</view>
						<view class="reply-btn" @click="send()">送出</view>
					</view>
				</view>

				<view class="section">
					<view class="label">收到的回应</view>
					<view v-if="!echoes.length" class="echo-empty">还没有回应。先给自己一个抱抱也可以。</view>
					<view v-for="(item, index) in echoes" :key="index" class="echo">
						<view class="echo-text">{{ item.text }}</view>
						<view class="echo-meta">
							<text>匿名</text>
							<text v-if="item.mine" class="echo-mine">我留的</text>
							<text v-if="item.pending" class="echo-mine">待同步</text>
							<text class="echo-time">{{ echoTime(item.at) }}</text>
						</view>
					</view>
				</view>

				<view class="actions">
					<view v-if="post.isMine" class="action danger" hover-class="action-hover" @click="remove">删除这条</view>
					<view v-else class="action" hover-class="action-hover" @click="report">举报</view>
				</view>
			</template>
		</template>
	</view>
	</glass-shell>
</template>

<script>
	import crisisCard from '@/components/crisis-card.vue'
	import { moodOf, PRESET_ECHOES } from '@/common/moods.js'
	import { formatTime } from '@/common/util.js'
	import { detectCrisis } from '@/common/crisis.js'
	import {
		getCachedPosts,
		upsertCachedPost,
		removeCachedPost,
		addPendingHug,
		addPendingEcho,
		isHugged,
		hugCount
	} from '@/common/store.js'
	import { api, requireLogin, isNetworkError, goLogin } from '@/common/api.js'

	export default {
		components: { crisisCard },
		data() {
			return {
				id: '',
				post: null,
				echoes: [],
				presets: PRESET_ECHOES,
				replyText: '',
				loading: false,
				missing: false
			}
		},
		computed: {
			mood() {
				return moodOf(this.post && this.post.mood)
			},
			timeText() {
				return this.post ? formatTime(this.post.at) : ''
			},
			hugged() {
				return isHugged(this.post)
			},
			count() {
				return hugCount(this.post)
			},
			showCrisis() {
				return this.post ? detectCrisis(this.post.text) : false
			}
		},
		onLoad(options) {
			this.id = options.id || ''
		},
		onShow() {
			this.load()
		},
		methods: {
			echoTime(ts) {
				return formatTime(ts)
			},
			async load() {
				const cached = getCachedPosts().find(item => item.id === this.id)
				if (cached) {
					this.post = cached
					this.missing = false
					if (cached.pending) return
				}

				this.loading = true
				try {
					const res = await api.getPost({ id: this.id })
					this.post = res.post
					this.echoes = res.echoes || []
					this.missing = false
					upsertCachedPost(res.post)
				} catch (error) {
					if (isNetworkError(error) && cached) {
						// 离线时保留缓存
					} else if (error.code === 'NEED_LOGIN' && cached) {
						// 未登录时保留缓存，互动时会提示登录
					} else {
						this.post = cached || null
						this.missing = !cached
					}
				} finally {
					this.loading = false
				}
			},
			async onHug() {
				if (!this.post || this.post.pending) {
					uni.showToast({ title: '这条还在等待同步', icon: 'none' })
					return
				}
				if (!requireLogin()) return
				try {
					const res = await api.hug({ postId: this.id })
					if (res.ok) {
						this.post = { ...this.post, hugged: true, hugCount: res.hugCount }
						upsertCachedPost(this.post)
					}
					uni.showToast({ title: res.ok ? '抱一下收到了' : res.message, icon: 'none' })
				} catch (error) {
					if (isNetworkError(error)) {
						addPendingHug(this.id)
						this.post = { ...this.post, hugged: true, hugCount: (this.post.hugCount || 0) + 1 }
						upsertCachedPost(this.post)
						uni.showToast({ title: '先记下了，联网后再送达', icon: 'none' })
					} else if (error.code === 'NEED_LOGIN') {
						goLogin()
					} else {
						uni.showToast({ title: error.message, icon: 'none' })
					}
				}
			},
			async send(text) {
				if (!this.post || this.post.pending) return
				const value = typeof text === 'string' ? text : this.replyText
				if (!String(value || '').trim()) {
					uni.showToast({ title: '写一句再送出吧', icon: 'none' })
					return
				}
				if (!requireLogin()) return

				try {
					const res = await api.echo({ postId: this.id, text: value })
					this.echoes.push(res.echo || { text: value, at: Date.now(), mine: true })
					this.replyText = ''
					uni.showToast({ title: '已经送到', icon: 'none' })
				} catch (error) {
					if (isNetworkError(error)) {
						addPendingEcho(this.id, value)
						this.echoes.push({ text: String(value).slice(0, 40), at: Date.now(), mine: true, pending: true })
						this.replyText = ''
						uni.showToast({ title: '先记下了，联网后再送达', icon: 'none' })
					} else if (error.code === 'NEED_LOGIN') {
						goLogin()
					} else {
						uni.showToast({ title: error.message, icon: 'none' })
					}
				}
			},
			remove() {
				uni.showModal({
					title: '删除这条',
					content: '删除后就找不回来了，其他人也看不到。',
					confirmText: '删除',
					confirmColor: '#BE8567',
					success: async res => {
						if (!res.confirm) return
						try {
							await api.deletePost({ postId: this.id })
							removeCachedPost(this.id)
							uni.navigateBack()
						} catch (error) {
							if (error.code === 'NEED_LOGIN') {
								goLogin()
							} else {
								uni.showToast({ title: error.message, icon: 'none' })
							}
						}
					}
				})
			},
			report() {
				if (!requireLogin()) return
				const reasons = ['广告或引流', '伤害性内容', '辱骂或攻击', '其他']
				const keys = ['spam', 'harm', 'abuse', 'other']
				uni.showActionSheet({
					itemList: reasons,
					success: async res => {
						try {
							const result = await api.reportPost({
								postId: this.id,
								reason: keys[res.tapIndex] || 'other'
							})
							uni.showToast({ title: result.message || '已收到', icon: 'none' })
						} catch (error) {
							if (error.code === 'NEED_LOGIN') {
								goLogin()
							} else {
								uni.showToast({ title: error.message, icon: 'none' })
							}
						}
					}
				})
			}
		}
	}
</script>

<style scoped>
	.page {
		min-height: 100vh;
		padding: 32rpx;
	}

	.card {
		padding: 36rpx;
		border-radius: 32rpx;
		background:
			radial-gradient(120% 90% at 100% 0%, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0) 58%),
			linear-gradient(165deg, rgba(255, 255, 255, 0.56) 0%, rgba(255, 255, 255, 0.36) 100%);
		border: 1px solid rgba(255, 255, 255, 0.8);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.95),
			0 0 0 1px rgba(120, 110, 98, 0.045),
			0 14rpx 34rpx rgba(74, 64, 54, 0.09);
		-webkit-backdrop-filter: blur(20px) saturate(160%);
		backdrop-filter: blur(20px) saturate(160%);
	}

	.head {
		display: flex;
		align-items: center;
	}

	.mood {
		display: flex;
		align-items: center;
		padding: 6rpx 18rpx 6rpx 14rpx;
		border-radius: 20rpx;
		border: 1px solid rgba(255, 255, 255, 0.5);
		font-size: 23rpx;
	}

	.mood-dot {
		width: 10rpx;
		height: 10rpx;
		margin-right: 10rpx;
		border-radius: 5rpx;
		opacity: 0.8;
	}

	.time {
		margin-left: 16rpx;
		font-size: 23rpx;
		color: #5F5A52;
	}

	.mine {
		margin-left: auto;
		font-size: 22rpx;
		color: #5F5A52;
	}

	.body {
		margin-top: 26rpx;
		font-size: 31rpx;
		line-height: 1.9;
		color: #2A2723;
		white-space: pre-wrap;
	}

	.foot {
		margin-top: 32rpx;
		display: flex;
		align-items: center;
	}

	.hug {
		display: flex;
		align-items: center;
		padding: 0 30rpx;
		height: 84rpx;
		border-radius: 42rpx;
		background: rgba(255, 255, 255, 0.45);
		border: 1px solid rgba(255, 255, 255, 0.8);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
		font-size: 27rpx;
		color: #3E5B69;
		transition: background 0.15s ease, transform 0.15s ease;
	}

	.hug-hover {
		transform: scale(0.97);
	}

	.hug.hugged {
		background: rgba(78, 110, 92, 0.14);
		border-color: rgba(78, 110, 92, 0.22);
		color: #3F5C4C;
	}

	/* 抱一下：双臂环抱一颗心，矢量图标（不用字符，也不用 emoji） */
	.hug-icon {
		flex-shrink: 0;
		width: 40rpx;
		height: 40rpx;
		margin-right: 10rpx;
		background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%233E5B69' stroke-width='2.1' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 20.2c-1-.7-8-5.2-8-10a4.2 4.2 0 018-1.9 4.2 4.2 0 018 1.9c0 4.8-7 9.3-8 10z'/%3E%3C/svg%3E") no-repeat center / 100% 100%;
	}

	.hug.hugged .hug-icon {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%233F5C4C' stroke-width='2.1' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 20.2c-1-.7-8-5.2-8-10a4.2 4.2 0 018-1.9 4.2 4.2 0 018 1.9c0 4.8-7 9.3-8 10z'/%3E%3C/svg%3E");
	}

	.hug-count {
		margin-left: 10rpx;
		font-size: 24rpx;
		color: #5F5A52;
	}

	.hug.hugged .hug-count {
		color: #3F5C4C;
	}

	.tip {
		margin: 20rpx 0 0;
		padding: 22rpx 26rpx;
		border-radius: 22rpx;
		background: rgba(255, 255, 255, 0.42);
		border: 1px solid rgba(255, 255, 255, 0.75);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
		font-size: 24rpx;
		line-height: 1.7;
		color: #5F5A52;
	}

	.section {
		margin-top: 44rpx;
	}

	.label {
		margin-bottom: 20rpx;
		font-size: 26rpx;
		color: #5F5A52;
	}

	.presets {
		display: flex;
		flex-wrap: wrap;
	}

	.preset {
		margin: 0 16rpx 16rpx 0;
		padding: 0 28rpx;
		height: 76rpx;
		line-height: 72rpx;
		border-radius: 38rpx;
		background: rgba(255, 255, 255, 0.5);
		border: 1px solid rgba(255, 255, 255, 0.72);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85);
		font-size: 26rpx;
		color: #4A453E;
		transition: background 0.15s ease, transform 0.15s ease;
	}

	.preset-hover {
		background: rgba(255, 255, 255, 0.75);
		transform: scale(0.96);
	}

	.reply {
		display: flex;
		align-items: center;
		margin-top: 8rpx;
	}

	.reply-field {
		flex: 1;
		min-width: 0;
		height: 90rpx;
		padding: 0 28rpx;
		display: flex;
		align-items: center;
		border-radius: 45rpx;
		background: rgba(255, 255, 255, 0.46);
		border: 1px solid rgba(255, 255, 255, 0.75);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
		-webkit-backdrop-filter: blur(12px) saturate(150%);
		backdrop-filter: blur(12px) saturate(150%);
	}

	.reply-input {
		width: 100%;
		height: 88rpx;
		font-size: 27rpx;
		color: #2A2723;
	}

	.placeholder {
		color: #5F5A52;
	}

	.reply-btn {
		margin-left: 16rpx;
		padding: 0 36rpx;
		height: 90rpx;
		line-height: 90rpx;
		border-radius: 45rpx;
		background: linear-gradient(150deg, #5D7C8C 0%, #3E5B69 100%);
		color: #FFFFFF;
		font-size: 27rpx;
		box-shadow: 0 8rpx 20rpx rgba(62, 91, 105, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.28);
	}

	.echo {
		position: relative;
		margin-bottom: 18rpx;
		padding: 26rpx 28rpx 24rpx 30rpx;
		border-radius: 26rpx;
		background: rgba(255, 255, 255, 0.46);
		border: 1px solid rgba(255, 255, 255, 0.75);
		border-left: 6rpx solid rgba(120, 110, 98, 0.16);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
	}

	.echo-text {
		font-size: 28rpx;
		line-height: 1.72;
		color: #2A2723;
	}

	.echo-meta {
		margin-top: 12rpx;
		display: flex;
		align-items: center;
		font-size: 22rpx;
		color: #5F5A52;
	}

	.echo-mine {
		margin-left: 12rpx;
		color: #5F5A52;
	}

	.echo-time {
		margin-left: auto;
	}

	.echo-empty {
		padding: 30rpx;
		border-radius: 26rpx;
		background: rgba(255, 255, 255, 0.42);
		border: 1px solid rgba(255, 255, 255, 0.75);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
		font-size: 26rpx;
		color: #5F5A52;
	}

	.actions {
		margin-top: 40rpx;
		padding: 8rpx 0 60rpx;
		text-align: center;
	}

	.action {
		display: inline-block;
		padding: 0 36rpx;
		height: 76rpx;
		line-height: 76rpx;
		border-radius: 38rpx;
		background: rgba(255, 255, 255, 0.48);
		border: 1px solid rgba(255, 255, 255, 0.75);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
		font-size: 25rpx;
		color: #5F5A52;
	}

	.action.danger {
		background: rgba(190, 133, 103, 0.14);
		border-color: rgba(190, 133, 103, 0.25);
		color: #8A5A3C;
	}

	.action-hover {
		opacity: 0.8;
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
