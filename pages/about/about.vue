<template>
	<glass-shell>
	<view class="page">
		<view class="head">
			<view class="title">关于缓一缓</view>
			<view class="slogan">一个不评判的出口，和一点能落地的解释。</view>
		</view>

		<view class="block">
			<view class="block-title">为什么做这个</view>
			<view class="block-text">容易内耗的人并不缺信息，缺的是一个不会被比较、被评价、被追问的出口。这里没有粉丝、点赞和排行榜，只有「抱一下」和几句善意。</view>
		</view>

		<view class="block">
			<view class="block-title">它不是</view>
			<view class="block-text">不做诊断，不做量表评分，不给用药建议，也不是心理咨询。文章用于情绪科普与自我理解，如果有持续困扰，请寻求专业帮助。</view>
		</view>

		<view class="block">
			<view class="block-title">关于数据</view>
			<view class="block-text">帖子会同步到云端并公开，所有访问者都能看到，但只会展示为「匿名」，不展示你的账号、昵称或手机号。不登录也可以发帖，删除权限记录在当前这台设备上。本地昵称、收藏、已读只存在这台设备上，不会上传。账号用于跨设备识别「这条是我写的」。</view>
		</view>

		<view class="block">
			<view class="block-title">危机时</view>
			<view class="block-text">如果你有伤害自己的念头，请优先联系 12356 心理援助热线、010-82951332，或直接拨打 120。</view>
			<view class="help-link" @click="goHelp">查看求助资源 ›</view>
		</view>

		<view class="block">
			<view class="block-title">社区规则</view>
			<view class="block-text">这里只允许善意的表达。广告引流、辱骂攻击、伤害性内容会被屏蔽词拦截或转入审核；任何帖子都可以举报，多人举报后会自动进入审核。</view>
		</view>

		<view class="block">
			<view class="block-title">数据管理</view>
			<view class="row" @click="exportData">
				<text>导出本机数据 JSON</text>
				<text class="arrow">›</text>
			</view>
		</view>

		<view class="version">缓一缓 v0.6.2 · Android 内测版</view>
	</view>
	</glass-shell>
</template>

<script>
	import { exportJSON } from '@/common/store.js'

	export default {
		methods: {
			goHelp() {
				uni.navigateTo({ url: '/pages/help/help' })
			},
			exportData() {
				uni.setClipboardData({
					data: exportJSON(),
					success() {
						uni.showToast({ title: '已复制到剪贴板', icon: 'none' })
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

	.slogan {
		margin-top: 14rpx;
		font-size: 27rpx;
		line-height: 1.7;
		color: #5F5A52;
	}

	.block {
		margin-bottom: 24rpx;
		padding: 30rpx;
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

	.block-title {
		font-size: 29rpx;
		font-weight: 600;
		color: #2A2723;
	}

	.block-text {
		margin-top: 14rpx;
		font-size: 27rpx;
		line-height: 1.85;
		color: #5F5A52;
	}

	.help-link {
		margin-top: 18rpx;
		font-size: 26rpx;
		color: #3E5B69;
	}

	.row {
		display: flex;
		align-items: center;
		margin-top: 20rpx;
		padding-top: 20rpx;
		border-top: 1px solid rgba(255, 255, 255, 0.6);
		font-size: 28rpx;
		color: #2A2723;
	}

	.arrow {
		margin-left: auto;
		color: #5F5A52;
		font-size: 34rpx;
	}

	.version {
		margin-top: 40rpx;
		text-align: center;
		font-size: 23rpx;
		color: #5F5A52;
	}
</style>
