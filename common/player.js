// 「听一点」播放器（只播本机音频）
// 规则照 my-music/AGENTS.md 第 5 章：
// - 单例，页面不自己建 context
// - 每首歌重建 InnerAudioContext（旧的先 destroy，避免 -99 / 事件串台）
// - 播放前校验文件存在，失效就不硬播
// - 事件 + 页面轮询双保险

import { localFileExists } from './content-uri.js'

let ctx = null
let current = null
let playing = false
let position = 0
let duration = 0
let timerId = null
let timerEnd = 0
let errorNotified = false

const VOLUME_KEY = 'huanhuan.volume.v1'

function readVolume() {
	try {
		const saved = uni.getStorageSync(VOLUME_KEY)
		if (typeof saved === 'number' && saved >= 0 && saved <= 1) return saved
	} catch (e) {
		// 忽略
	}
	return 0.8
}

function saveVolume(value) {
	try {
		uni.setStorageSync(VOLUME_KEY, value)
	} catch (e) {
		// 忽略
	}
}

let volume = readVolume()

function emit() {
	uni.$emit('hh-audio', snapshot())
}

export function snapshot() {
	return {
		trackId: current ? current.id : '',
		playing,
		position,
		duration: duration || (current ? current.duration : 0),
		timerEnd,
		volume
	}
}

function destroyCtx() {
	if (!ctx) return
	try {
		ctx.stop()
	} catch (e) {}
	try {
		ctx.destroy()
	} catch (e) {}
	ctx = null
}

function createCtx() {
	destroyCtx()
	const audio = uni.createInnerAudioContext()
	audio.autoplay = true
	audio.loop = true
	audio.volume = volume
	// #ifdef APP-PLUS
	audio.sessionCategory = 'playback'
	// #endif

	audio.onPlay(() => {
		if (audio !== ctx) return
		playing = true
		errorNotified = false
		emit()
	})
	audio.onPause(() => {
		if (audio !== ctx) return
		playing = false
		emit()
	})
	audio.onStop(() => {
		if (audio !== ctx) return
		playing = false
		position = 0
		emit()
	})
	audio.onCanplay(() => {
		if (audio !== ctx) return
		if (audio.duration) {
			duration = audio.duration
			emit()
		}
		// autoplay 在个别环境不生效，这里补一次（已加载完成，不会丢）
		if (!playing) {
			try {
				audio.play()
			} catch (e) {}
		}
	})
	audio.onTimeUpdate(() => {
		if (audio !== ctx) return
		position = audio.currentTime || 0
		if (audio.duration) duration = audio.duration
		emit()
	})
	audio.onError(err => {
		console.warn('[play] 播放出错', JSON.stringify(err || {}), current ? current.path : '')
		if (audio !== ctx) return
		playing = false
		emit()
		if (errorNotified) return
		errorNotified = true
		uni.showToast({ title: '这个音频没法播放', icon: 'none' })
	})

	ctx = audio
	return audio
}

export function playTrack(track) {
	if (!track || !track.path) return

	// #ifdef APP-PLUS
	if (!localFileExists(track.path)) {
		current = track
		playing = false
		position = 0
		emit()
		uni.showToast({ title: '文件已失效，请重新添加', icon: 'none' })
		return
	}
	// #endif

	current = track
	position = 0
	playing = false
	duration = track.duration || 0
	errorNotified = false
	const audio = createCtx()
	audio.src = track.path
	emit()
}

export function toggle() {
	if (!current) return
	if (!ctx) {
		playTrack(current)
		return
	}
	if (playing) {
		try {
			ctx.pause()
		} catch (e) {}
		return
	}
	try {
		ctx.play()
	} catch (e) {
		playTrack(current)
	}
}

export function seek(seconds) {
	const value = Math.max(0, Math.min(Number(seconds) || 0, duration || 0))
	position = value
	if (ctx) {
		try {
			ctx.seek(value)
		} catch (e) {}
	}
	emit()
}

export function stop() {
	destroyCtx()
	playing = false
	position = 0
	emit()
}

export function setVolume(value, persist) {
	const next = Math.max(0, Math.min(1, Number(value) || 0))
	volume = next
	if (ctx) {
		try {
			ctx.volume = next
		} catch (e) {
			// 忽略
		}
	}
	if (persist) saveVolume(next)
	emit()
}

export function getVolume() {
	return volume
}

export function setSleepTimer(minutes) {
	if (timerId) {
		clearTimeout(timerId)
		timerId = null
	}
	const value = Number(minutes) || 0
	timerEnd = value > 0 ? Date.now() + value * 60 * 1000 : 0

	if (value > 0) {
		timerId = setTimeout(() => {
			timerId = null
			timerEnd = 0
			if (ctx && playing) {
				try {
					ctx.pause()
				} catch (e) {}
			}
			emit()
			uni.showToast({ title: '时间到了，声音先停下', icon: 'none' })
		}, value * 60 * 1000)
	}
	emit()
}

export function getCurrentId() {
	return current ? current.id : ''
}
