<template>
	<glass-shell variant="dusk">
	<view class="page" :class="{ 'has-player': !!current }">
		<view class="intro">
			<view class="intro-sub">从手机里挑一段声音，今晚让它替你守夜。可以一直循环，也可以定时关闭。</view>
		</view>

		<view class="tools">
			<view class="local-add" @click="pickLocal">
				<text class="local-plus">＋</text>
				<text>从手机添加音频</text>
			</view>
			<view v-if="!managing" class="manage" @click="managing = true">管理</view>
			<view v-else class="manage on" @click="managing = false">完成</view>
		</view>

		<view v-if="managing" class="manage-tip">
			<text>点右边的按钮移出列表</text>
			<text class="manage-link" @click="restoreBuiltins">恢复自带音频</text>
		</view>

		<view class="tracks">
			<view
				v-for="item in locals"
				:key="item.id"
				class="track"
				:class="{ active: currentId === item.id, managing, broken: item.broken }"
				@click="managing ? null : select(item)"
			>
				<view class="track-badge" :style="{ background: badgeBg(item), color: badgeFg(item) }">
					<view class="wave">
						<view class="bar b1"></view>
						<view class="bar b2"></view>
						<view class="bar b3"></view>
					</view>
				</view>

				<view class="track-main">
					<view class="track-title">{{ item.title }}</view>
					<view class="track-desc">{{ item.broken ? '文件已失效，请移出后重新添加' : (item.desc || '手机里的音频') }}</view>
				</view>

				<view class="track-right">
					<text class="track-time">{{ item.duration ? clock(item.duration) : '本地' }}</text>
					<text v-if="!managing" class="track-state">{{ currentId === item.id && playing ? '播放中' : '播放' }}</text>
				</view>

				<view v-if="managing" class="track-remove" @click.stop="removeLocal(item)">
					<view class="minus"></view>
				</view>
			</view>
		</view>

		<view v-if="!locals.length" class="empty">
			<view class="empty-title">还没有添加音频</view>
			<view class="empty-text">点上面的「从手机添加音频」，选一首本机的歌或白噪音。添加后会复制一份到应用里，之后一直能播。</view>
		</view>

		<view class="note">自带 5 段声音首次进入时会复制一份到应用里；你添加的音频也只存在这台手机，不会上传。移出时只删应用里的副本，不动你原来的文件。切到后台可能会暂停。</view>

		<view v-if="current" class="player">
			<view class="player-top">
				<view class="player-title">{{ current.title }}</view>
				<text class="player-timer" @click="chooseTimer">{{ timerLabel }}</text>
			</view>

			<slider
				class="player-slider"
				:value="sliderValue"
				:min="0"
				:max="duration || 1"
				block-size="12"
				activeColor="#9FB5D0"
				backgroundColor="#4A423B"
				@change="onSeek"
			/>

			<view class="player-times">
				<text>{{ clock(position) }}</text>
				<text>{{ clock(duration) }}</text>
			</view>

			<view class="player-controls">
				<view class="ctrl side" @click="prev"><view class="chev left"></view></view>
				<view class="ctrl main" @click="toggle">
					<view v-if="playing" class="pause-bars"><view class="pause-bar"></view><view class="pause-bar"></view></view>
					<view v-else class="play-tri"></view>
				</view>
				<view class="ctrl side" @click="next"><view class="chev right"></view></view>
			</view>
		</view>
	</view>
	</glass-shell>
</template>

<script>
	import { getLocalTracks, addTrack, hasTrack, addPickedTrack, removeTrack, findLocalTrack, refreshBrokenState, formatClock } from '@/common/listen.js'
	import { pickAudioFile } from '@/common/file-picker.js'
	import { seedBuiltinAudio, resetBuiltinSeed, builtinSeeded } from '@/common/audio-library.js'
	import { playTrack, toggle, seek, stop, snapshot, setSleepTimer } from '@/common/player.js'

	export default {
		data() {
			return {
				locals: [],
				currentId: '',
				playing: false,
				position: 0,
				duration: 0,
				timerEnd: 0,
				now: Date.now(),
				managing: false,
				tick: null,
				poll: null
			}
		},
		computed: {
			current() {
				return findLocalTrack(this.currentId)
			},
			sliderValue() {
				return Math.min(this.position, this.duration || 0)
			},
			timerLabel() {
				if (!this.timerEnd) return '定时'
				const left = Math.max(0, this.timerEnd - this.now)
				return '剩余 ' + Math.ceil(left / 60000) + ' 分钟'
			}
		},
		onLoad() {
			uni.$on('hh-audio', this.onAudioState)
		},
		onShow() {
			this.locals = refreshBrokenState()
			this.applyState(snapshot())
			this.tick = setInterval(() => {
				this.now = Date.now()
			}, 30000)
			// 事件之外再轮询：App 端事件偶尔会丢，进度条和按钮不能靠碰运气
			this.poll = setInterval(() => {
				this.applyState(snapshot())
			}, 500)
			this.ensureBuiltins()
		},
		onHide() {
			if (this.tick) clearInterval(this.tick)
			this.tick = null
			if (this.poll) clearInterval(this.poll)
			this.poll = null
		},
		onUnload() {
			uni.$off('hh-audio', this.onAudioState)
			if (this.tick) clearInterval(this.tick)
			if (this.poll) clearInterval(this.poll)
		},
		methods: {
			clock(value) {
				return formatClock(value)
			},
			ensureBuiltins() {
				if (builtinSeeded()) return
				seedBuiltinAudio({ addTrack, hasTrack }).then(added => {
					this.locals = refreshBrokenState()
					if (added) console.log('[listen] 自带音频已就绪', added)
				})
			},
			restoreBuiltins() {
				resetBuiltinSeed()
				seedBuiltinAudio({ addTrack, hasTrack }).then(() => {
					this.locals = refreshBrokenState()
					uni.showToast({ title: '已恢复自带音频', icon: 'none' })
				})
			},
			applyState(state) {
				if (!state) return
				this.currentId = state.trackId || ''
				this.playing = !!state.playing
				this.position = state.position || 0
				this.duration = state.duration || 0
				this.timerEnd = state.timerEnd || 0
			},
			onAudioState(state) {
				this.applyState(state)
			},
			select(track) {
				if (track && track.broken) {
					uni.showToast({ title: '文件已失效，请移出后重新添加', icon: 'none' })
					return
				}
				playTrack(track)
			},
			toggle() {
				toggle()
			},
			prev() {
				if (!this.locals.length) return
				const index = this.locals.findIndex(item => item.id === this.currentId)
				playTrack(this.locals[(index <= 0 ? this.locals.length : index) - 1])
			},
			next() {
				if (!this.locals.length) return
				const index = this.locals.findIndex(item => item.id === this.currentId)
				playTrack(this.locals[(index + 1) % this.locals.length])
			},
			onSeek(event) {
				seek(event.detail.value)
			},
			pickLocal() {
				// 选择 → 复制到应用私有目录 → 入库，全在 file-picker 里完成
				pickAudioFile(
					info => this.handlePicked(info),
					err => {
						const message = (err && (err.errMsg || err.message)) || ''
						if (message && message.indexOf('cancel') > -1) return
						console.warn('[listen] 选择音频失败', message)
					}
				)
			},
			handlePicked(info) {
				const res = addPickedTrack(info)
				this.locals = getLocalTracks()
				if (!res.ok) {
					uni.showToast({ title: res.reason || '没有添加成功', icon: 'none' })
					return
				}
				this.managing = false
				uni.showToast({ title: '已添加，点一下就能播', icon: 'none' })
			},
			badgeBg(item) {
				return item.broken ? 'rgba(190, 133, 103, 0.18)' : 'rgba(159, 181, 208, 0.18)'
			},
			badgeFg(item) {
				return item.broken ? '#E2B79C' : '#CFE0F2'
			},
			removeLocal(item) {
				uni.showModal({
					title: '移出这个音频？',
					content: '只会移除应用里存的那份副本，不会删除手机里原来的文件。',
					confirmText: '移出',
					confirmColor: '#BE8567',
					success: res => {
						if (!res.confirm) return
						removeTrack(item.id)
						this.locals = getLocalTracks()
						if (this.currentId === item.id) {
							stop()
							this.currentId = ''
						}
					}
				})
			},
			chooseTimer() {
				const labels = ['关闭定时', '15 分钟', '30 分钟', '60 分钟']
				uni.showActionSheet({
					itemList: labels,
					success: res => {
						const minutes = [0, 15, 30, 60][res.tapIndex] || 0
						setSleepTimer(minutes)
						uni.showToast({
							title: minutes ? '已设置 ' + minutes + ' 分钟' : '已关闭定时',
							icon: 'none'
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
		padding: 24rpx 32rpx 220rpx;
	}

	.page.has-player {
		padding-bottom: 420rpx;
	}

	.intro {
		padding: 4rpx 8rpx 26rpx;
	}

	.intro-sub {
		font-size: 25rpx;
		line-height: 1.7;
		color: #B9B1A8;
	}

	.tools {
		display: flex;
		align-items: center;
		margin: 0 8rpx 20rpx;
	}

	.local-add {
		display: inline-flex;
		align-items: center;
		height: 76rpx;
		padding: 0 30rpx;
		border-radius: 38rpx;
		border: 1px dashed rgba(255, 255, 255, 0.18);
		font-size: 24rpx;
		color: #B9B1A8;
	}

	.local-plus {
		margin-right: 8rpx;
		font-size: 28rpx;
		color: #9FB5D0;
	}

	.manage {
		margin-left: auto;
		padding: 0 30rpx;
		height: 64rpx;
		line-height: 62rpx;
		border-radius: 32rpx;
		border: 1px solid rgba(255, 255, 255, 0.14);
		background: rgba(255, 255, 255, 0.06);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
		font-size: 23rpx;
		color: #D8D2CB;
	}

	.manage.on {
		border-color: rgba(159, 181, 208, 0.5);
		background: rgba(159, 181, 208, 0.16);
		color: #DCE7F2;
	}

	.manage-tip {
		display: flex;
		align-items: center;
		margin: -6rpx 8rpx 18rpx;
		font-size: 22rpx;
		color: #9B948C;
	}

	.manage-link {
		margin-left: auto;
		padding: 6rpx 0 6rpx 20rpx;
		color: #9FB5D0;
	}

	.track {
		display: flex;
		align-items: center;
		margin-bottom: 18rpx;
		padding: 26rpx 28rpx;
		border-radius: 30rpx;
		background:
			radial-gradient(120% 120% at 85% 0%, rgba(198, 173, 155, 0.16), transparent 55%),
			radial-gradient(120% 120% at 0% 0%, rgba(169, 178, 176, 0.12), transparent 50%),
			radial-gradient(120% 120% at 100% 100%, rgba(184, 166, 196, 0.12), transparent 55%),
			linear-gradient(165deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%);
		border: 1px solid rgba(255, 255, 255, 0.1);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 12rpx 30rpx rgba(0, 0, 0, 0.26);
		-webkit-backdrop-filter: blur(18px) saturate(140%);
		backdrop-filter: blur(18px) saturate(140%);
	}

	.track.active {
		border-color: rgba(159, 181, 208, 0.5);
		background:
			radial-gradient(120% 120% at 85% 0%, rgba(198, 173, 155, 0.18), transparent 55%),
			radial-gradient(120% 120% at 0% 0%, rgba(169, 178, 176, 0.14), transparent 50%),
			radial-gradient(120% 120% at 100% 100%, rgba(184, 166, 196, 0.14), transparent 55%),
			linear-gradient(165deg, rgba(255, 255, 255, 0.11) 0%, rgba(255, 255, 255, 0.05) 100%);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 12rpx 30rpx rgba(0, 0, 0, 0.3);
	}

	.track.managing {
		border-color: rgba(255, 255, 255, 0.14);
	}

	.track.broken .track-title {
		color: #E2B79C;
	}

	.track-badge {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 84rpx;
		height: 84rpx;
		border-radius: 26rpx;
	}

	.wave {
		display: flex;
		align-items: flex-end;
		height: 36rpx;
	}

	.bar {
		width: 6rpx;
		margin: 0 3rpx;
		border-radius: 3rpx;
		background: currentColor;
		opacity: 0.85;
	}

	.b1 {
		height: 18rpx;
	}

	.b2 {
		height: 32rpx;
	}

	.b3 {
		height: 24rpx;
	}

	.track-main {
		flex: 1;
		min-width: 0;
		margin-left: 22rpx;
	}

	.track-title {
		font-size: 29rpx;
		font-weight: 600;
		color: #F2EFEA;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.track-desc {
		margin-top: 8rpx;
		font-size: 23rpx;
		color: #B9B1A8;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.track-right {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		margin-left: 16rpx;
	}

	.track-time {
		font-size: 21rpx;
		color: #9B948C;
	}

	.track-state {
		margin-top: 10rpx;
		font-size: 21rpx;
		color: #9FB5D0;
	}

	.track-remove {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 64rpx;
		height: 64rpx;
		margin-left: 14rpx;
		border-radius: 32rpx;
		border: 1px solid rgba(226, 183, 156, 0.42);
		background: rgba(226, 183, 156, 0.12);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
	}

	.minus {
		width: 22rpx;
		height: 4rpx;
		border-radius: 2rpx;
		background: #E2B79C;
	}

	.empty {
		padding: 40rpx 32rpx;
		border-radius: 30rpx;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
	}

	.empty-title {
		font-size: 28rpx;
		font-weight: 600;
		color: #E8E3DC;
	}

	.empty-text {
		margin-top: 10rpx;
		font-size: 23rpx;
		line-height: 1.7;
		color: #B9B1A8;
	}

	.note {
		margin: 26rpx 8rpx 0;
		font-size: 22rpx;
		line-height: 1.8;
		color: #9B948C;
	}

	.player {
		position: fixed;
		left: 0;
		right: 0;
		bottom: var(--window-bottom, 0px);
		z-index: 90;
		padding: 18rpx 32rpx calc(16rpx + env(safe-area-inset-bottom));
		background: rgba(31, 27, 24, 0.82);
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 -8rpx 30rpx rgba(0, 0, 0, 0.3);
		-webkit-backdrop-filter: blur(22px) saturate(140%);
		backdrop-filter: blur(22px) saturate(140%);
	}

	.player-top {
		display: flex;
		align-items: center;
	}

	.player-title {
		font-size: 28rpx;
		font-weight: 600;
		color: #F2EFEA;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 70%;
	}

	.player-timer {
		margin-left: auto;
		padding: 10rpx 20rpx;
		border-radius: 22rpx;
		background: rgba(255, 255, 255, 0.08);
		font-size: 22rpx;
		color: #D8D2CB;
	}

	.player-slider {
		margin: 10rpx 0 0;
	}

	.player-times {
		display: flex;
		justify-content: space-between;
		margin-top: -8rpx;
		font-size: 20rpx;
		color: #9B948C;
	}

	.player-controls {
		display: flex;
		align-items: center;
		justify-content: center;
		margin-top: 10rpx;
	}

	.ctrl {
		display: flex;
		align-items: center;
		justify-content: center;
		color: #D8D2CB;
	}

	.ctrl.side {
		width: 100rpx;
		height: 80rpx;
		font-size: 40rpx;
	}

	.ctrl.main {
		width: 96rpx;
		height: 96rpx;
		margin: 0 50rpx;
		border-radius: 48rpx;
		background: #9FB5D0;
		color: #26211D;
		box-shadow: 0 10rpx 24rpx rgba(159, 181, 208, 0.22);
	}

	.play-tri {
		width: 0;
		height: 0;
		margin-left: 8rpx;
		border-top: 15rpx solid transparent;
		border-bottom: 15rpx solid transparent;
		border-left: 24rpx solid #26211D;
	}

	.pause-bars {
		display: flex;
		align-items: center;
	}

	.pause-bar {
		width: 8rpx;
		height: 30rpx;
		margin: 0 4rpx;
		border-radius: 4rpx;
		background: #26211D;
	}

	.chev {
		width: 18rpx;
		height: 18rpx;
		border-top: 4rpx solid currentColor;
		border-right: 4rpx solid currentColor;
	}

	.chev.left {
		transform: rotate(-135deg);
	}

	.chev.right {
		transform: rotate(45deg);
	}
</style>
