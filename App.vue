<script>
	import { ensure, flushPending } from '@/common/store.js'
	import { api, isLoggedIn } from '@/common/api.js'
	import uniIdPageInit from '@/uni_modules/uni-id-pages/init.js'

	export default {
		globalData: {
			config: {},
			$i18n: {},
			$t: {}
		},
		onLaunch: function() {
			this.globalData.$i18n = this.$i18n
			this.globalData.$t = str => this.$t(str)
			uniIdPageInit()
			ensure()
			this.syncPending()
			uni.$on('uni-id-pages-login-success', () => {
				this.syncPending()
			})
		},
		onShow: function() {
			ensure()
		},
		methods: {
			async syncPending() {
				if (!isLoggedIn()) return
				try {
					await flushPending(api)
				} catch (e) {
					// 离线时保留队列，下次启动或登录后重试
				}
			}
		}
	}
</script>

<style>
	page {
		background-color: #F6F2EC;
		color: #2A2723;
		font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
		-webkit-font-smoothing: antialiased;
	}

	view,
	text,
	image,
	scroll-view,
	input,
	textarea {
		-webkit-tap-highlight-color: transparent;
		box-sizing: border-box;
	}
</style>
