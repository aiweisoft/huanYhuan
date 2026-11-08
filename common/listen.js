// 「听一点」只保存本机音频
// 数据模型：{ id, title, duration, uri, path, broken }
//   uri  —— 原始 content://，副本丢失时可重新复制
//   path —— 应用私有副本（_doc/audio/），长期可用

import { deleteManagedCopy, localFileExists } from './content-uri.js'

const LOCAL_KEY = 'huanhuan.localTracks.v1'

function normalize(item) {
	if (!item || typeof item !== 'object') return null
	const path = item.path || item.file || ''
	if (!path) return null
	return {
		id: item.id || 'local_' + Math.random().toString(36).slice(2, 10),
		title: item.title || '本地音频',
		desc: item.desc || '',
		duration: Number(item.duration) || 0,
		uri: item.uri || '',
		path,
		builtin: !!item.builtin,
		broken: !!item.broken
	}
}

function readLocal() {
	try {
		const value = uni.getStorageSync(LOCAL_KEY)
		const list = Array.isArray(value) ? value : []
		return list.map(normalize).filter(Boolean)
	} catch (e) {
		return []
	}
}

function writeLocal(list) {
	try {
		uni.setStorageSync(LOCAL_KEY, list)
	} catch (e) {}
}

export function getLocalTracks() {
	return readLocal()
}

export function findLocalTrack(id) {
	return readLocal().find(item => item.id === id) || null
}

export function hasTrack(id) {
	return readLocal().some(item => item.id === id)
}

/** 直接写入一条记录（自带音频铺数据时用） */
export function addTrack(track) {
	if (!track || !track.path) return false
	if (hasTrack(track.id)) return false
	const list = readLocal()
	list.unshift({
		id: track.id,
		title: String(track.title || '本地音频').slice(0, 60),
		desc: track.desc || '',
		duration: Number(track.duration) || 0,
		uri: track.uri || '',
		path: track.path,
		builtin: !!track.builtin,
		broken: false
	})
	writeLocal(list.slice(0, 50))
	return true
}

/** info 来自 file-picker：{ path, uri, name, title, duration } */
export function addPickedTrack(info) {
	if (!info || !info.path) return { ok: false, reason: '没有可用的文件路径' }
	const list = readLocal()
	const exists = list.some(item => item.path === info.path || (info.uri && item.uri === info.uri))
	if (exists) return { ok: false, reason: '这首已经在列表里了' }

	const track = {
		id: 'local_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
		title: String(info.title || info.name || '本地音频').slice(0, 60),
		desc: '',
		duration: Number(info.duration) || 0,
		uri: info.uri || '',
		path: info.path,
		builtin: false,
		broken: false
	}
	list.unshift(track)
	writeLocal(list.slice(0, 50))
	return { ok: true, track }
}

export function removeTrack(id) {
	const list = readLocal()
	const target = list.find(item => item.id === id)
	if (target) deleteManagedCopy(target.path)
	writeLocal(list.filter(item => item.id !== id))
}

export function markBroken(id, broken) {
	const list = readLocal()
	const target = list.find(item => item.id === id)
	if (!target) return
	if (!!target.broken === !!broken) return
	target.broken = !!broken
	writeLocal(list)
}

/** 启动时校验副本还在不在（仅 App 有效，H5 的路径是临时 blob） */
export function refreshBrokenState() {
	const list = readLocal()
	// #ifdef APP-PLUS
	let changed = false
	list.forEach(item => {
		const missing = !localFileExists(item.path)
		if (item.broken !== missing) {
			item.broken = missing
			changed = true
		}
	})
	if (changed) writeLocal(list)
	// #endif
	return list
}

export function formatClock(seconds) {
	const value = Math.max(0, Math.floor(Number(seconds) || 0))
	const m = Math.floor(value / 60)
	const s = value % 60
	return m + ':' + (s < 10 ? '0' + s : s)
}
