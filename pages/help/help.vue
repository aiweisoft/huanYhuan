<template>
	<glass-shell>
	<view class="page">
		<view class="head">
			<view class="title">如果现在很难受</view>
			<view class="sub">先找一个人说说话。下面这些号码 24 小时有人接。</view>
		</view>

		<view class="hotlines">
			<view class="hotline primary" @click="call('12356')">
				<view class="hotline-main">
					<view class="hotline-name">全国统一心理援助热线</view>
					<view class="hotline-number">12356</view>
				</view>
				<view class="hotline-action">拨打</view>
			</view>
			<view class="hotline" @click="call('01082951332')">
				<view class="hotline-main">
					<view class="hotline-name">北京心理危机研究与干预中心</view>
					<view class="hotline-number">010-82951332</view>
				</view>
				<view class="hotline-action">拨打</view>
			</view>
			<view class="hotline" @click="call('120')">
				<view class="hotline-main">
					<view class="hotline-name">急救</view>
					<view class="hotline-number">120</view>
				</view>
				<view class="hotline-action">拨打</view>
			</view>
		</view>

		<view class="block">
			<view class="block-title">什么时候需要尽快找人</view>
			<view class="block-text">如果出现伤害自己的念头、已经做了伤害自己的事，或者觉得无法保证自己的安全，请立刻联系上面的热线或急救，也可以直接去最近的医院急诊。</view>
		</view>

		<view class="block">
			<view class="block-title">去医院可以挂什么科</view>
			<view class="block-text">综合医院的精神科、心理科，或者当地精神卫生中心。第一次去不需要准备完整的话，说「最近状态不好，想做个评估」就可以。</view>
		</view>

		<view class="block">
			<view class="block-title">如果朋友向你求助</view>
			<view class="block-text">可以先说「我在」「你愿意说多少都可以」。不必急着给建议，也不要承诺替对方保密到危险的地步。如果对方有伤害自己的风险，陪他联系专业帮助。</view>
		</view>

		<view class="block">
			<view class="block-title">对自己说</view>
			<view class="block-text">现在难受，不代表你不够坚强。求助不是失败，是把重量分一点出去。</view>
		</view>
	</view>
	</glass-shell>
</template>

<script>
	export default {
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
			}
		}
	}
</script>

<style scoped>
	.page {
		min-height: 100vh;
		padding: 32rpx;
	}

	.head {
		padding: 16rpx 8rpx 32rpx;
	}

	.title {
		font-size: 42rpx;
		font-weight: 600;
		color: #2A2723;
	}

	.sub {
		margin-top: 14rpx;
		font-size: 27rpx;
		line-height: 1.7;
		color: #5F5A52;
	}

	.hotline {
		display: flex;
		align-items: center;
		margin-bottom: 20rpx;
		padding: 30rpx;
		border-radius: 30rpx;
		background:
			radial-gradient(120% 90% at 100% 0%, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0) 58%),
			linear-gradient(165deg, rgba(255, 255, 255, 0.54) 0%, rgba(255, 255, 255, 0.34) 100%);
		border: 1px solid rgba(255, 255, 255, 0.8);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 12rpx 30rpx rgba(74, 64, 54, 0.08);
		-webkit-backdrop-filter: blur(18px) saturate(160%);
		backdrop-filter: blur(18px) saturate(160%);
	}

	.hotline.primary {
		background:
			radial-gradient(120% 90% at 100% 0%, rgba(190, 133, 103, 0.22) 0%, rgba(190, 133, 103, 0) 60%),
			linear-gradient(165deg, rgba(255, 255, 255, 0.58) 0%, rgba(255, 255, 255, 0.38) 100%);
		border: 1px solid rgba(190, 133, 103, 0.45);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 12rpx 30rpx rgba(156, 106, 78, 0.12);
	}

	.hotline-main {
		flex: 1;
	}

	.hotline-name {
		font-size: 25rpx;
		color: #5F5A52;
	}

	.hotline-number {
		margin-top: 10rpx;
		font-size: 38rpx;
		font-weight: 600;
		color: #2A2723;
	}

	.hotline-action {
		padding: 0 32rpx;
		height: 76rpx;
		line-height: 76rpx;
		border-radius: 38rpx;
		background: linear-gradient(150deg, #5D7C8C 0%, #3E5B69 100%);
		color: #FFFFFF;
		font-size: 26rpx;
		box-shadow: 0 8rpx 20rpx rgba(62, 91, 105, 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.28);
	}

	.block {
		margin-top: 30rpx;
		padding: 30rpx;
		border-radius: 30rpx;
		background: rgba(255, 255, 255, 0.46);
		border: 1px solid rgba(255, 255, 255, 0.75);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 8rpx 22rpx rgba(74, 64, 54, 0.06);
		-webkit-backdrop-filter: blur(16px) saturate(150%);
		backdrop-filter: blur(16px) saturate(150%);
	}

	.block-title {
		font-size: 29rpx;
		font-weight: 600;
		color: #2A2723;
	}

	.block-text {
		margin-top: 14rpx;
		font-size: 27rpx;
		line-height: 1.8;
		color: #5F5A52;
	}
</style>
