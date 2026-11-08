<template>
	<view class="post-card" hover-class="card-hover" hover-stay-time="80" @click="$emit('open', post)">
		<view class="post-head">
			<view class="mood" :style="{ background: mood.bg, color: mood.fg }">{{ post.moodLabel || mood.label }}</view>
			<view class="time">{{ timeText }}</view>
			<view v-if="post.pending" class="flag">待同步</view>
			<view v-else-if="post.reviewing" class="flag">审核中</view>
			<view v-if="post.mine" class="mine">我写的</view>
		</view>

		<view class="post-body">{{ post.text }}</view>

		<view class="post-foot">
			<view class="hug" :class="{ hugged }" @click.stop="$emit('hug', post)">
				<view class="hug-icon"></view>
				<text>{{ hugged ? '已抱过' : '抱一下' }}</text>
				<text v-if="count" class="hug-count">{{ count }}</text>
			</view>
			<view class="echo-count" v-if="echoes">{{ echoes }} 条回应</view>
		</view>
	</view>
</template>

<script>
	import { moodOf } from '@/common/moods.js'
	import { formatTime } from '@/common/util.js'
	import { isHugged, hugCount, wordEchoes } from '@/common/store.js'

	export default {
		name: 'post-card',
		props: {
			post: {
				type: Object,
				required: true
			}
		},
		computed: {
			mood() {
				return moodOf(this.post.mood)
			},
			timeText() {
				return formatTime(this.post.at)
			},
			hugged() {
				return isHugged(this.post)
			},
			count() {
				return hugCount(this.post)
			},
			echoes() {
				return wordEchoes(this.post).length
			}
		},
		methods: {
			onHug() {
				this.$emit('hug', this.post)
			}
		}
	}
</script>

<style scoped>
	.post-card {
		position: relative;
		margin-bottom: 18rpx;
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
		transition: transform 0.12s ease, box-shadow 0.2s ease;
	}

	.card-hover {
		transform: scale(0.99);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.92),
			0 4rpx 12rpx rgba(74, 64, 54, 0.06);
	}

	.post-head {
		display: flex;
		align-items: center;
	}

	.mood {
		padding: 5rpx 16rpx;
		border-radius: 18rpx;
		border: 1px solid rgba(255, 255, 255, 0.5);
		font-size: 22rpx;
	}

	.time {
		margin-left: 14rpx;
		font-size: 22rpx;
		color: #5F5A52;
	}

	.mine {
		margin-left: auto;
		font-size: 21rpx;
		color: #5F5A52;
	}

	.flag {
		margin-left: 10rpx;
		padding: 2rpx 12rpx;
		border-radius: 11rpx;
		background: rgba(255, 255, 255, 0.55);
		border: 1px solid rgba(255, 255, 255, 0.7);
		font-size: 19rpx;
		color: #5F5A52;
	}

	.post-body {
		margin-top: 16rpx;
		font-size: 30rpx;
		line-height: 1.85;
		color: #2A2723;
		white-space: pre-wrap;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 5;
		overflow: hidden;
	}

	.post-foot {
		margin-top: 18rpx;
		display: flex;
		align-items: center;
	}

	.hug {
		display: flex;
		align-items: center;
		height: 80rpx;
		padding: 0 26rpx;
		border-radius: 40rpx;
		background: rgba(255, 255, 255, 0.42);
		border: 1px solid rgba(255, 255, 255, 0.8);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), inset 0 -1px 0 rgba(255, 255, 255, 0.3);
		font-size: 25rpx;
		color: #3E5B69;
	}

	.hug.hugged {
		background: rgba(78, 110, 92, 0.14);
		border-color: rgba(78, 110, 92, 0.22);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);
		color: #3F5C4C;
	}

	/* 抱一下：双臂环抱一颗心，矢量图标（不用字符，也不用 emoji） */
	.hug-icon {
		flex-shrink: 0;
		width: 36rpx;
		height: 36rpx;
		margin-right: 8rpx;
		background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%233E5B69' stroke-width='2.1' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 20.2c-1-.7-8-5.2-8-10a4.2 4.2 0 018-1.9 4.2 4.2 0 018 1.9c0 4.8-7 9.3-8 10z'/%3E%3C/svg%3E") no-repeat center / 100% 100%;
	}

	.hug.hugged .hug-icon {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%233F5C4C' stroke-width='2.1' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 20.2c-1-.7-8-5.2-8-10a4.2 4.2 0 018-1.9 4.2 4.2 0 018 1.9c0 4.8-7 9.3-8 10z'/%3E%3C/svg%3E");
	}

	.hug-count {
		margin-left: 7rpx;
		font-size: 22rpx;
		color: #5F5A52;
	}

	.hug.hugged .hug-count {
		color: #3F5C4C;
	}

	.echo-count {
		margin-left: auto;
		font-size: 22rpx;
		color: #5F5A52;
	}
</style>
