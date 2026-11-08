<template>
	<glass-shell>
	<view class="page">
		<view class="privacy-pill">
			<view class="privacy-dot"></view>
			<text>匿名发布 · 只显示昵称，不留头像和手机号</text>
		</view>

		<view class="section">
			<view class="label-row">
				<view class="label">此刻更接近</view>
				<!-- <view class="custom-link" @click="openCustom">{{ customLabel ? '改一下' : '自定义' }}</view> -->
			</view>
			<scroll-view class="mood-scroll" scroll-x :show-scrollbar="false">
				<view class="mood-row">
					<view class="mood" :class="{ on: !!customLabel }" @click="openCustom">{{ customLabel || '＋ 自定义' }}</view>
					<view
						v-for="item in moods"
						:key="item.id"
						class="mood"
						:class="{ on: !customLabel && mood === item.id }"
						@click="pickMood(item.id)"
					>{{ item.label }}</view>
				</view>
			</scroll-view>
		</view>

		<view class="section">
			<view class="label">想说什么都行</view>
			<view class="editor-wrap">
				<textarea
					class="editor"
					v-model="text"
					:maxlength="500"
					placeholder="不用组织语言，写下来就好。"
					placeholder-class="placeholder"
					auto-height
				/>
				<view class="counter">{{ text.length }} / 500</view>
			</view>
		</view>

		<crisis-card v-if="showCrisis" />

		<view class="tips">发布后所有人都能看到，但没人知道是你。登录后可以抱一抱别人，也能收到回应。</view>

		<view class="actions">
			<view class="btn ghost" hover-class="btn-hover" @click="back">先不写了</view>
			<view class="btn primary" :class="{ disabled: !canSubmit || submitting }" hover-class="btn-hover" @click="submit">{{ submitting ? '发送中…' : '发布' }}</view>
		</view>

		<view v-if="customOpen" class="mask" @click="closeCustom">
			<view class="sheet" @click.stop>
				<view class="sheet-title">给这一刻起个名字</view>
				<view class="sheet-sub">最多 6 个字，比如「麻木」「说不清」。分组仍按上面选的情绪算。</view>
				<view class="sheet-field">
					<input
						v-model="customDraft"
						class="sheet-input"
						:maxlength="6"
						:focus="customOpen"
						placeholder="写一个词"
						placeholder-class="placeholder"
						confirm-type="done"
						@confirm="applyCustom"
					/>
					<text class="sheet-count">{{ customDraft.length }}/6</text>
				</view>
				<view class="sheet-actions">
					<view class="sheet-btn ghost" @click="closeCustom">取消</view>
					<view class="sheet-btn primary" @click="applyCustom">就用这个</view>
				</view>
				<view v-if="customLabel" class="sheet-clear" @click="clearCustom">不用自定义了</view>
			</view>
		</view>
	</view>
	</glass-shell>
</template>

<script>
	import crisisCard from '@/components/crisis-card.vue'
	import { MOODS } from '@/common/moods.js'
	import { detectCrisis } from '@/common/crisis.js'
	import { addPendingPost, upsertCachedPost } from '@/common/store.js'
	import { api, isNetworkError, goLogin } from '@/common/api.js'

	export default {
		components: { crisisCard },
		data() {
			return {
				moods: MOODS,
				mood: 'anxious',
				customLabel: '',
				customOpen: false,
				customDraft: '',
				text: '',
				submitting: false
			}
		},
		computed: {
			showCrisis() {
				return detectCrisis(this.text)
			},
			canSubmit() {
				return this.text.trim().length > 0
			}
		},
		methods: {
			pickMood(id) {
				this.mood = id
				this.customLabel = ''
			},
			openCustom() {
				this.customDraft = this.customLabel
				this.customOpen = true
			},
			closeCustom() {
				this.customOpen = false
			},
			clearCustom() {
				this.customLabel = ''
				this.customDraft = ''
				this.customOpen = false
			},
			applyCustom() {
				const value = String(this.customDraft || '').replace(/\s+/g, '').trim().slice(0, 6)
				if (!value) {
					uni.showToast({ title: '写一个词吧', icon: 'none' })
					return
				}
				this.customLabel = value
				this.customOpen = false
			},
			back() {
				uni.navigateBack()
			},
			async submit() {
				if (!this.canSubmit) {
					uni.showToast({ title: '先写一句吧', icon: 'none' })
					return
				}
				if (this.submitting) return

				this.submitting = true
				try {
					const res = await api.createPost({ mood: this.mood, text: this.text, moodLabel: this.customLabel })
					if (res.post && !res.post.reviewing) {
						upsertCachedPost(res.post)
					}
					uni.setStorageSync('huanhuan.resetFilter', 1)
					uni.showToast({
						title: res.post && res.post.reviewing ? '已提交，稍后展示' : '已经放好了',
						icon: 'none'
					})
					setTimeout(() => {
						uni.navigateBack()
					}, 300)
				} catch (error) {
					if (isNetworkError(error)) {
						addPendingPost({ mood: this.mood, text: this.text, moodLabel: this.customLabel })
						uni.showToast({ title: '已存本机，联网后自动发送', icon: 'none' })
						setTimeout(() => {
							uni.navigateBack()
						}, 500)
					} else if (error.code === 'NEED_LOGIN') {
						goLogin()
					} else {
						uni.showToast({ title: error.message, icon: 'none' })
					}
				} finally {
					this.submitting = false
				}
			}
		}
	}
</script>

<style scoped>
	.page {
		min-height: 100vh;
		padding: 24rpx 32rpx 240rpx;
	}

	.privacy-pill {
		display: inline-flex;
		align-items: center;
		margin-bottom: 36rpx;
		padding: 10rpx 24rpx 10rpx 18rpx;
		border-radius: 30rpx;
		background: rgba(255, 255, 255, 0.48);
		border: 1px solid rgba(255, 255, 255, 0.75);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
		font-size: 23rpx;
		color: #3E5B69;
	}

	.privacy-dot {
		width: 12rpx;
		height: 12rpx;
		margin-right: 12rpx;
		border-radius: 6rpx;
		background: #3E5B69;
		opacity: 0.75;
	}

	.section {
		margin-bottom: 36rpx;
	}

	.label {
		margin-bottom: 20rpx;
		font-size: 26rpx;
		color: #5F5A52;
	}

	.label-row {
		display: flex;
		align-items: center;
		margin-bottom: 20rpx;
	}

	.label-row .label {
		margin-bottom: 0;
	}

	.custom-link {
		margin-left: auto;
		padding: 6rpx 0 6rpx 24rpx;
		font-size: 24rpx;
		color: #3E5B69;
	}

	.mood-scroll {
		white-space: nowrap;
		margin-bottom: 6rpx;
	}

	.mood-row {
		display: inline-flex;
		padding: 2rpx 0;
	}

	.mood {
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

	.mood.on {
		background: #3E5B69;
		border-color: rgba(62, 91, 105, 0.9);
		box-shadow: 0 8rpx 20rpx rgba(62, 91, 105, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.22);
		color: #FFFFFF;
	}

	.editor-wrap {
		position: relative;
		padding: 28rpx 28rpx 58rpx;
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

	.editor {
		width: 100%;
		min-height: 300rpx;
		font-size: 30rpx;
		line-height: 1.85;
		color: #2A2723;
	}

	.placeholder {
		color: #5F5A52;
	}

	.counter {
		position: absolute;
		right: 28rpx;
		bottom: 20rpx;
		font-size: 22rpx;
		color: #5F5A52;
	}

	.tips {
		margin: 8rpx 4rpx 40rpx;
		font-size: 24rpx;
		line-height: 1.7;
		color: #5F5A52;
	}

	.actions {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		padding: 20rpx 32rpx calc(20rpx + env(safe-area-inset-bottom));
		background: linear-gradient(180deg, rgba(246, 242, 236, 0) 0%, rgba(246, 242, 236, 0.92) 42%, #F6F2EC 100%);
		-webkit-backdrop-filter: blur(10px);
		backdrop-filter: blur(10px);
	}

	.btn {
		flex: 1;
		height: 96rpx;
		line-height: 96rpx;
		text-align: center;
		border-radius: 48rpx;
		font-size: 29rpx;
		transition: opacity 0.15s ease, transform 0.15s ease;
	}

	.btn-hover {
		opacity: 0.86;
		transform: scale(0.98);
	}

	.btn.ghost {
		margin-right: 20rpx;
		background: rgba(255, 255, 255, 0.5);
		border: 1px solid rgba(255, 255, 255, 0.75);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
		color: #5F5A52;
	}

	.btn.primary {
		background: linear-gradient(150deg, #5D7C8C 0%, #3E5B69 100%);
		color: #FFFFFF;
		box-shadow: 0 10rpx 26rpx rgba(62, 91, 105, 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.28);
	}

	.btn.primary.disabled {
		opacity: 0.45;
		box-shadow: none;
	}

	.mask {
		position: fixed;
		left: 0;
		right: 0;
		top: 0;
		bottom: 0;
		z-index: 200;
		display: flex;
		align-items: flex-end;
		background: rgba(38, 33, 29, 0.32);
	}

	.sheet {
		width: 100%;
		padding: 36rpx 32rpx calc(30rpx + env(safe-area-inset-bottom));
		border-radius: 36rpx 36rpx 0 0;
		background: rgba(255, 255, 255, 0.94);
		border-top: 1px solid rgba(255, 255, 255, 0.9);
		box-shadow: 0 -20rpx 50rpx rgba(60, 52, 44, 0.18);
		-webkit-backdrop-filter: blur(20px) saturate(160%);
		backdrop-filter: blur(20px) saturate(160%);
	}

	.sheet-title {
		font-size: 32rpx;
		font-weight: 600;
		color: #2A2723;
	}

	.sheet-sub {
		margin-top: 10rpx;
		font-size: 24rpx;
		line-height: 1.6;
		color: #5F5A52;
	}

	.sheet-field {
		display: flex;
		align-items: center;
		margin-top: 24rpx;
		padding: 0 24rpx;
		height: 92rpx;
		border-radius: 22rpx;
		background: rgba(255, 255, 255, 0.7);
		border: 1px solid rgba(120, 110, 98, 0.14);
	}

	.sheet-input {
		flex: 1;
		height: 92rpx;
		font-size: 30rpx;
		color: #2A2723;
	}

	.sheet-count {
		margin-left: 16rpx;
		font-size: 22rpx;
		color: #5F5A52;
	}

	.sheet-actions {
		display: flex;
		margin-top: 26rpx;
	}

	.sheet-btn {
		flex: 1;
		height: 92rpx;
		line-height: 92rpx;
		text-align: center;
		border-radius: 46rpx;
		font-size: 28rpx;
	}

	.sheet-btn.ghost {
		margin-right: 18rpx;
		background: rgba(255, 255, 255, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.85);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
		color: #5F5A52;
	}

	.sheet-btn.primary {
		background: linear-gradient(150deg, #5D7C8C 0%, #3E5B69 100%);
		color: #FFFFFF;
		box-shadow: 0 10rpx 24rpx rgba(62, 91, 105, 0.24);
	}

	.sheet-clear {
		margin-top: 20rpx;
		text-align: center;
		font-size: 24rpx;
		color: #5F5A52;
		text-decoration: underline;
		text-underline-offset: 4rpx;
	}
</style>
