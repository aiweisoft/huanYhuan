<template>
	<view class="crisis-card">
		<view class="crisis-title">先停一下</view>
		<view class="crisis-text">你现在难受是真的，不用一个人扛。如果此刻有伤害自己的念头，可以马上联系下面的人。</view>
		<view class="crisis-actions">
			<view class="crisis-btn primary" @click="call('12356')">12356 心理援助</view>
			<view class="crisis-btn" @click="call('01082951332')">010-82951332</view>
			<view class="crisis-btn" @click="call('120')">120 急救</view>
		</view>
		<view class="crisis-more" @click="goHelp">更多求助方式</view>
	</view>
</template>

<script>
	export default {
		name: 'crisis-card',
		methods: {
			call(phone) {
				uni.makePhoneCall({
					phoneNumber: phone,
					fail() {
						uni.setClipboardData({
							data: phone,
							success() {
								uni.showToast({ title: '号码已复制', icon: 'none' })
							}
						})
					}
				})
			},
			goHelp() {
				uni.navigateTo({ url: '/pages/help/help' })
			}
		}
	}
</script>

<style scoped>
	.crisis-card {
		margin: 24rpx 0;
		padding: 32rpx;
		border-radius: 30rpx;
		background:
			radial-gradient(120% 90% at 100% 0%, rgba(190, 133, 103, 0.24) 0%, rgba(190, 133, 103, 0) 60%),
			linear-gradient(165deg, rgba(255, 255, 255, 0.58) 0%, rgba(255, 255, 255, 0.38) 100%);
		border: 1px solid rgba(190, 133, 103, 0.45);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 12rpx 30rpx rgba(156, 106, 78, 0.12);
		-webkit-backdrop-filter: blur(18px) saturate(160%);
		backdrop-filter: blur(18px) saturate(160%);
	}

	.crisis-title {
		font-size: 32rpx;
		font-weight: 600;
		color: #8A5A3C;
	}

	.crisis-text {
		margin-top: 14rpx;
		font-size: 28rpx;
		line-height: 1.8;
		color: #4A3F39;
	}

	.crisis-actions {
		margin-top: 24rpx;
		display: flex;
		flex-wrap: wrap;
	}

	.crisis-btn {
		margin: 0 16rpx 16rpx 0;
		padding: 0 24rpx;
		height: 88rpx;
		line-height: 86rpx;
		border-radius: 44rpx;
		background: rgba(255, 255, 255, 0.55);
		border: 1px solid rgba(190, 133, 103, 0.42);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
		font-size: 27rpx;
		color: #7A4E38;
	}

	.crisis-btn.primary {
		background: #9C6A4E;
		border-color: #9C6A4E;
		color: #FFFFFF;
		box-shadow: 0 8rpx 20rpx rgba(156, 106, 78, 0.24);
	}

	.crisis-more {
		margin-top: 6rpx;
		font-size: 26rpx;
		color: #5F5A52;
		text-decoration: underline;
	}
</style>
