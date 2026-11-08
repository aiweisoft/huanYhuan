// 本机音频选择器
// App：用 DCloud 自带的 plus.io.chooseFile（它自己处理 onActivityResult，兼容性比我们接原生 Intent 好），
//      选完立刻 ensureLocalCopy：content:// 一律复制到 _doc/audio/，之后只播副本
// H5：uni.chooseFile（临时路径，仅用于调试）

import { ensureLocalCopy, getLastCopyError } from './content-uri.js'

export function pickAudioFile(callback, errorCallback) {
	// #ifdef APP-PLUS
	pickWithPlus(callback, errorCallback)
	// #endif

	// #ifndef APP-PLUS
	uni.chooseFile({
		count: 1,
		type: 'all',
		extension: ['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.flac'],
		success(res) {
			const file = (res.tempFiles && res.tempFiles[0]) || null
			const path = (file && file.path) || (res.tempFilePaths && res.tempFilePaths[0]) || ''
			if (!path) {
				if (errorCallback) errorCallback(new Error('没有拿到文件路径'))
				return
			}
			const name = (file && file.name) || String(path).split('/').pop() || ''
			const dot = name.lastIndexOf('.')
			callback &&
				callback({
					path,
					uri: '',
					name,
					title: dot > 0 ? name.substring(0, dot) : name,
					duration: 0
				})
		},
		fail(err) {
			const message = (err && (err.errMsg || err.message)) || ''
			if (message.indexOf('cancel') === -1 && errorCallback) errorCallback(err)
		}
	})
	// #endif
}

// #ifdef APP-PLUS
function pickWithPlus(callback, errorCallback) {
	if (!plus.io || typeof plus.io.chooseFile !== 'function') {
		if (errorCallback) errorCallback(new Error('当前版本不支持选择文件'))
		return
	}
	plus.io.chooseFile(
		{ title: '选择音频', filter: '*', multiple: false },
		event => {
			try {
				const files = event && (event.files || event.file)
				const file = Array.isArray(files) ? files[0] : files
				if (!file) return

				const raw = typeof file === 'string' ? file : (file.path || file.filePath || file.fullPath || '')
				const name = (file && file.name) || (raw ? String(raw).split('/').pop() : '')
				if (!raw) {
					if (errorCallback) errorCallback(new Error('没有拿到文件路径'))
					return
				}

				uni.showLoading({ title: '正在导入…', mask: true })
				const rawPath = raw.indexOf('file://') === 0 ? raw.slice(7) : raw
				const localPath = ensureLocalCopy(rawPath)
				uni.hideLoading()

				if (!localPath) {
					const reason = getLastCopyError() || '复制音频失败'
					console.warn('[file-picker] 导入失败:', raw, reason)
					setTimeout(() => {
						uni.showModal({ title: '导入失败', content: '原因：' + reason, showCancel: false })
					}, 150)
					if (errorCallback) errorCallback(new Error(reason))
					return
				}

				const base = name || String(localPath).split('/').pop() || ''
				const dot = base.lastIndexOf('.')
				const title = dot > 0 ? base.substring(0, dot) : base
				callback &&
					callback({
						path: localPath,
						uri: raw.indexOf('content://') === 0 ? raw : '',
						name: base,
						title,
						duration: readDuration(localPath)
					})
			} catch (e) {
				uni.hideLoading()
				console.error('[file-picker] 处理选择结果失败:', e)
				if (errorCallback) errorCallback(e)
			}
		},
		() => {}
	)
}

function readDuration(path) {
	try {
		const MMR = plus.android.importClass('android.media.MediaMetadataRetriever')
		const retriever = new MMR()
		retriever.setDataSource(path)
		const d = retriever.extractMetadata(9)
		retriever.release()
		return parseInt(d) || 0
	} catch (e) {
		return 0
	}
}
// #endif

