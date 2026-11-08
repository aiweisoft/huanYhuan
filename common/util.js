export function uid(prefix = 'p') {
	return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
}

function pad(num) {
	return num < 10 ? '0' + num : '' + num
}

export function formatTime(ts) {
	const now = Date.now()
	const diff = Math.max(0, now - ts)
	const minute = 60 * 1000
	const hour = 60 * minute
	const day = 24 * hour

	if (diff < minute) return '刚刚'
	if (diff < hour) return Math.floor(diff / minute) + ' 分钟前'
	if (diff < day) return Math.floor(diff / hour) + ' 小时前'
	if (diff < 2 * day) return '昨天'
	if (diff < 7 * day) return Math.floor(diff / day) + ' 天前'

	const date = new Date(ts)
	return date.getFullYear() + '年' + (date.getMonth() + 1) + '月' + date.getDate() + '日'
}

export function formatDate(ts) {
	const date = new Date(ts)
	return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate())
}

export function formatClock(ts) {
	const date = new Date(ts)
	return pad(date.getHours()) + ':' + pad(date.getMinutes())
}

export function countWords(text) {
	return String(text || '').length
}

export function openExternal(url) {
	if (!url) return
	// #ifdef H5
	window.open(url, '_blank')
	// #endif
	// #ifdef APP-PLUS
	plus.runtime.openURL(url)
	// #endif
	// #ifndef H5 || APP-PLUS
	uni.setClipboardData({
		data: url,
		success() {
			uni.showToast({ title: '原文链接已复制', icon: 'none' })
		}
	})
	// #endif
}
