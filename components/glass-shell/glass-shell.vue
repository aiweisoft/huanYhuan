<template>
	<view class="shell" :class="'v-' + variant">
		<view class="aurora">
			<view class="blob b1"></view>
			<view class="blob b2"></view>
			<view class="blob b3"></view>
			<view class="blob b4"></view>
			<view class="blob b5"></view>
			<view class="veil"></view>
		</view>
		<view class="sheet">
			<slot />
		</view>
	</view>
</template>

<script>
	export default {
		name: 'glass-shell',
		props: {
			variant: {
				type: String,
				default: 'light'
			}
		}
	}
</script>

<style scoped>
	.shell {
		position: relative;
		min-height: 100vh;
		overflow-x: hidden;
		background: #F6F2EC;
	}

	.v-dusk {
		background: #26211D;
	}

	.aurora {
		position: fixed;
		left: 0;
		top: 0;
		right: 0;
		bottom: 0;
		z-index: 0;
		overflow: hidden;
		pointer-events: none;
	}

	.blob {
		position: absolute;
		border-radius: 50%;
	}

	/* 右上角的柔光，为玻璃提供可透的色彩 */
	.b1 {
		width: 760rpx;
		height: 760rpx;
		top: -220rpx;
		left: -260rpx;
		background: radial-gradient(circle at 50% 50%,
			rgba(85, 112, 127, 0.50) 0%,
			rgba(85, 112, 127, 0.18) 44%,
			rgba(85, 112, 127, 0) 70%);
	}

	.b2 {
		width: 660rpx;
		height: 660rpx;
		top: 140rpx;
		right: -280rpx;
		background: radial-gradient(circle at 50% 50%,
			rgba(190, 133, 103, 0.48) 0%,
			rgba(190, 133, 103, 0.16) 46%,
			rgba(190, 133, 103, 0) 72%);
	}

	.b3 {
		width: 800rpx;
		height: 800rpx;
		bottom: -80rpx;
		left: -300rpx;
		background: radial-gradient(circle at 50% 50%,
			rgba(126, 158, 148, 0.42) 0%,
			rgba(126, 158, 148, 0.14) 46%,
			rgba(126, 158, 148, 0) 72%);
	}

	.b4 {
		width: 600rpx;
		height: 600rpx;
		bottom: 400rpx;
		right: -200rpx;
		background: radial-gradient(circle at 50% 50%,
			rgba(148, 138, 178, 0.32) 0%,
			rgba(148, 138, 178, 0.12) 46%,
			rgba(148, 138, 178, 0) 72%);
	}

	.b5 {
		width: 700rpx;
		height: 700rpx;
		top: 760rpx;
		left: -140rpx;
		background: radial-gradient(circle at 50% 50%,
			rgba(96, 132, 143, 0.30) 0%,
			rgba(96, 132, 143, 0.10) 46%,
			rgba(96, 132, 143, 0) 72%);
	}

	/* 顶部渐隐，让系统导航栏和页面无缝衔接 */
	.veil {
		position: absolute;
		left: 0;
		right: 0;
		top: 0;
		height: 220rpx;
		background: linear-gradient(180deg, rgba(246, 242, 236, 0.96) 0%, rgba(246, 242, 236, 0) 100%);
	}

	.v-dusk .veil {
		background: linear-gradient(180deg, rgba(38, 33, 29, 0.96) 0%, rgba(38, 33, 29, 0) 100%);
	}

	/* 暮色：给暗色玻璃一点冷光 */
	.v-dusk .b1 {
		background: radial-gradient(circle at 50% 50%,
			rgba(159, 181, 208, 0.34) 0%,
			rgba(159, 181, 208, 0.12) 44%,
			rgba(159, 181, 208, 0) 70%);
	}

	.v-dusk .b2 {
		background: radial-gradient(circle at 50% 50%,
			rgba(190, 133, 103, 0.30) 0%,
			rgba(190, 133, 103, 0.10) 46%,
			rgba(190, 133, 103, 0) 72%);
	}

	.v-dusk .b3 {
		background: radial-gradient(circle at 50% 50%,
			rgba(126, 158, 148, 0.24) 0%,
			rgba(126, 158, 148, 0.08) 46%,
			rgba(126, 158, 148, 0) 72%);
	}

	.v-dusk .b4 {
		background: radial-gradient(circle at 50% 50%,
			rgba(148, 138, 178, 0.24) 0%,
			rgba(148, 138, 178, 0.08) 46%,
			rgba(148, 138, 178, 0) 72%);
	}

	.v-dusk .b5 {
		background: radial-gradient(circle at 50% 50%,
			rgba(96, 132, 143, 0.22) 0%,
			rgba(96, 132, 143, 0.07) 46%,
			rgba(96, 132, 143, 0) 72%);
	}

	.sheet {
		position: relative;
		z-index: 1;
	}
</style>
