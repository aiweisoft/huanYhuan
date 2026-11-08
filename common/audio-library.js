// 自带音频（5 条）
// 不直接播包内路径：首次启动时把 APK assets 里的文件复制到 _doc/audio/，
// 之后和用户自己添加的音频走同一条播放链路（这才是真机能出声的那条路）。

export const BUILTIN_AUDIO = [
	{
		id: 'builtin-rain',
		title: '雨落在窗台',
		desc: '细密的雨，像有人在窗外轻声说话',
		file: '/static/audio/rain-window.mp3',
		duration: 120
	},
	{
		id: 'builtin-ocean',
		title: '夜里的海',
		desc: '远处的浪，一阵一阵慢慢拍上来',
		file: '/static/audio/ocean-night.mp3',
		duration: 120
	},
	{
		id: 'builtin-fire',
		title: '壁炉边',
		desc: '低频的暖响，房间是暖的',
		file: '/static/audio/fireplace.mp3',
		duration: 120
	},
	{
		id: 'builtin-stream',
		title: '清晨的溪流',
		desc: '清早的水声，凉一点也亮一点',
		file: '/static/audio/stream-morning.mp3',
		duration: 120
	},
	{
		id: 'builtin-sleep',
		title: '睡前十分钟',
		desc: '低频的嗡鸣和一点粉噪，给睡意留位置',
		file: '/static/audio/sleep-ten.mp3',
		duration: 120
	}
]

const SEED_KEY = 'huanhuan.builtinSeeded.v2'

export function builtinSeeded() {
	try {
		return !!uni.getStorageSync(SEED_KEY)
	} catch (e) {
		return false
	}
}

function markSeeded() {
	try {
		uni.setStorageSync(SEED_KEY, 1)
	} catch (e) {}
}

export function resetBuiltinSeed() {
	try {
		uni.removeStorageSync(SEED_KEY)
	} catch (e) {}
}

// #ifdef APP-PLUS
/** 从 APK 的 assets 复制到 _doc/audio/，返回副本路径 */
function copyAsset(file) {
	return new Promise(resolve => {
		const name = 'builtin_' + String(file).split('/').pop()
		const base = plus.io.convertLocalFileSystemURL('_doc/')
		if (!base) return resolve('')
		const dirPath = base + 'audio/'
		const targetPath = dirPath + name

		try {
			const File = plus.android.importClass('java.io.File')
			const dir = new File(dirPath)
			if (!plus.android.invoke(dir, 'exists')) plus.android.invoke(dir, 'mkdirs')

			const exist = new File(targetPath)
			if (plus.android.invoke(exist, 'exists')) {
				const size = plus.android.invoke(exist, 'length')
				if (typeof size === 'number' && size > 0) return resolve(targetPath)
				plus.android.invoke(exist, 'delete')
			}

			const appid = plus.runtime.appid || ''
			const assetPath = 'apps/' + appid + '/www' + file
			const activity = plus.android.runtimeMainActivity()
			const assets = plus.android.invoke(activity, 'getAssets')
			const input = plus.android.invoke(assets, 'open', assetPath)
			if (!input) return resolve('')

			const FileOutputStream = plus.android.importClass('java.io.FileOutputStream')
			const fos = new FileOutputStream(targetPath)
			try {
				try {
					plus.android.invoke(input, 'transferTo', fos)
				} catch (e0) {
					const Channels = plus.android.importClass('java.nio.channels.Channels')
					const ByteBuffer = plus.android.importClass('java.nio.ByteBuffer')
					const srcChannel = plus.android.invoke(Channels, 'newChannel', input)
					const dstChannel = plus.android.invoke(fos, 'getChannel')
					const buffer = plus.android.invoke(ByteBuffer, 'allocate', 65536)
					let n = plus.android.invoke(srcChannel, 'read', buffer)
					while (n !== -1) {
						plus.android.invoke(buffer, 'flip')
						plus.android.invoke(dstChannel, 'write', buffer)
						plus.android.invoke(buffer, 'clear')
						n = plus.android.invoke(srcChannel, 'read', buffer)
					}
					plus.android.invoke(srcChannel, 'close')
					plus.android.invoke(dstChannel, 'close')
				}
				plus.android.invoke(input, 'close')
			} finally {
				plus.android.invoke(fos, 'close')
			}

			const size = plus.android.invoke(exist, 'length')
			if (!size || size <= 0) {
				plus.android.invoke(exist, 'delete')
				return resolve('')
			}
			resolve(targetPath)
		} catch (e) {
			console.warn('[builtin] 复制自带音频失败', file, e)
			resolve('')
		}
	})
}
// #endif

/**
 * 首次启动时铺一遍自带音频
 * @param {Function} addTrack 由 listen.js 注入：addTrack({ id, title, duration, uri, path, builtin })
 * @param {Function} hasTrack 由 listen.js 注入：hasTrack(id)
 * @returns {Promise<number>} 新增条数
 */
export async function seedBuiltinAudio({ addTrack, hasTrack }) {
	if (builtinSeeded()) return 0
	let added = 0

	for (const item of BUILTIN_AUDIO) {
		if (hasTrack(item.id)) continue

		let path = ''
		// #ifdef APP-PLUS
		path = await copyAsset(item.file)
		// #endif
		// #ifndef APP-PLUS
		path = item.file
		// #endif

		if (!path) continue
		const ok = addTrack({
			id: item.id,
			title: item.title,
			desc: item.desc || '',
			duration: item.duration,
			uri: '',
			path,
			builtin: true
		})
		if (ok) added += 1
	}

	markSeeded()
	return added
}
