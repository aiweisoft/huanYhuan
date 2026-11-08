// 文字转语音适配层
// App 端走系统 TTS（Android: android.speech.tts；iOS: AVSpeechSynthesizer）
// H5 端走浏览器的 Web Speech API
// 用法：speak(text, { onEnd, onError }) / stopSpeak()

let androidTts = null
let androidReady = false
let androidFailed = false
let pendingText = ''
let iosSynth = null
let pollTimer = null
let pollStart = 0
let pollHeard = false
let endCallback = null
let errorCallback = null

function isAndroidApp() {
	return typeof plus !== 'undefined' && !!plus.android && plus.os && plus.os.name === 'Android'
}

function isIosApp() {
	return typeof plus !== 'undefined' && !!plus.ios && plus.os && plus.os.name === 'iOS'
}

function hasH5Speech() {
	return typeof window !== 'undefined' && !!window.speechSynthesis
}

export function canSpeak() {
	return isAndroidApp() || isIosApp() || hasH5Speech()
}

/** 按标点切成小段：TTS 引擎对单次文本长度有限制 */
function splitText(text, size = 280) {
	const clean = String(text || '').replace(/\s+/g, ' ').trim()
	const parts = []
	let rest = clean
	while (rest.length > size) {
		let cut = -1
		for (const mark of ['。', '！', '？', '；', '，', '.', '!', '?', ';', ',', '、']) {
			const idx = rest.lastIndexOf(mark, size)
			if (idx > cut) cut = idx
		}
		if (cut < size * 0.4) cut = size - 1
		parts.push(rest.slice(0, cut + 1).trim())
		rest = rest.slice(cut + 1)
	}
	if (rest.trim()) parts.push(rest.trim())
	return parts.filter(Boolean)
}

function stopPolling() {
	if (pollTimer) {
		clearInterval(pollTimer)
		pollTimer = null
	}
}

function finish() {
	stopPolling()
	const cb = endCallback
	endCallback = null
	if (cb) cb()
}

function startPolling(getSpeaking) {
	stopPolling()
	pollStart = Date.now()
	pollHeard = false
	pollTimer = setInterval(() => {
		let speaking = false
		try {
			speaking = !!getSpeaking()
		} catch (e) {
			speaking = false
		}
		if (speaking) pollHeard = true
		const elapsed = Date.now() - pollStart
		if ((pollHeard && !speaking) || (!pollHeard && elapsed > 6000)) finish()
	}, 700)
}

/* ------------------------- Android ------------------------- */

function initAndroid() {
	if (androidTts) return
	try {
		const TextToSpeech = plus.android.importClass('android.speech.tts.TextToSpeech')
		const activity = plus.android.runtimeMainActivity()
		const listener = plus.android.implements('android.speech.tts.TextToSpeech$OnInitListener', {
			onInit(status) {
				if (status !== 0) {
					androidFailed = true
					pendingText = ''
					stopPolling()
					const cb = errorCallback
					errorCallback = null
					if (cb) cb()
					return
				}
				androidReady = true
				try {
					const Locale = plus.android.importClass('java.util.Locale')
					plus.android.invoke(androidTts, 'setLanguage', new Locale('zh', 'CN'))
				} catch (e) {
					// 没有中文语音包时用系统默认
				}
				try {
					plus.android.invoke(androidTts, 'setSpeechRate', 0.95)
				} catch (e) {
					// 语速设置失败不影响朗读
				}
				if (pendingText) {
					const text = pendingText
					pendingText = ''
					speakAndroid(text)
				}
			}
		})
		androidTts = new TextToSpeech(activity, listener)
	} catch (e) {
		androidFailed = true
	}
}

function speakAndroid(text) {
	if (!androidTts || !androidReady) {
		pendingText = text
		return
	}
	try {
		plus.android.invoke(androidTts, 'stop')
	} catch (e) {
		// 忽略
	}
	const chunks = splitText(text)
	if (!chunks.length) {
		finish()
		return
	}
	chunks.forEach((part, index) => {
		const id = 'hh' + Date.now() + '-' + index
		try {
			plus.android.invoke(androidTts, 'speak', part, 1, null, id)
		} catch (e) {
			try {
				plus.android.invoke(androidTts, 'speak', part, 1, null)
			} catch (err) {
				// 单段失败时跳过
			}
		}
	})
	startPolling(() => plus.android.invoke(androidTts, 'isSpeaking'))
}

/* ------------------------- iOS ------------------------- */

function speakIos(text) {
	try {
		const AVSpeechSynthesizer = plus.ios.importClass('AVSpeechSynthesizer')
		const AVSpeechUtterance = plus.ios.importClass('AVSpeechUtterance')
		const AVSpeechSynthesisVoice = plus.ios.importClass('AVSpeechSynthesisVoice')
		if (!iosSynth) iosSynth = new AVSpeechSynthesizer()
		const chunks = splitText(text, 400)
		chunks.forEach(part => {
			const utter = AVSpeechUtterance.speechUtteranceWithString(part)
			try {
				const voice = AVSpeechSynthesisVoice.voiceWithLanguage('zh-CN')
				if (voice) plus.ios.invoke(utter, 'setVoice:', voice)
			} catch (e) {
				// 用系统默认语音
			}
			plus.ios.invoke(iosSynth, 'speakUtterance:', utter)
		})
		startPolling(() => plus.ios.invoke(iosSynth, 'isSpeaking'))
		return true
	} catch (e) {
		return false
	}
}

/* ------------------------- H5 ------------------------- */

function speakH5(text) {
	const synth = window.speechSynthesis
	try {
		synth.cancel()
	} catch (e) {
		// 忽略
	}
	const chunks = splitText(text, 200)
	chunks.forEach((part, index) => {
		const utter = new SpeechSynthesisUtterance(part)
		utter.lang = 'zh-CN'
		utter.rate = 0.95
		if (index === chunks.length - 1) {
			utter.onend = finish
			utter.onerror = finish
		}
		synth.speak(utter)
	})
	return true
}

/* ------------------------- 对外接口 ------------------------- */

export function speak(text, { onEnd, onError } = {}) {
	const content = String(text || '').trim()
	if (!content) return false
	stopSpeak()
	endCallback = onEnd || null
	errorCallback = onError || null

	if (isAndroidApp()) {
		initAndroid()
		if (androidFailed) {
			errorCallback = null
			if (onError) onError()
			return false
		}
		speakAndroid(content)
		return true
	}

	if (isIosApp()) {
		const ok = speakIos(content)
		if (!ok && onError) onError()
		return ok
	}

	if (hasH5Speech()) return speakH5(content)

	return false
}

export function stopSpeak() {
	stopPolling()
	endCallback = null
	errorCallback = null
	pendingText = ''
	if (androidTts) {
		try {
			plus.android.invoke(androidTts, 'stop')
		} catch (e) {
			// 忽略
		}
	}
	if (iosSynth) {
		try {
			plus.ios.invoke(iosSynth, 'stopSpeakingAtBoundary:', 0)
		} catch (e) {
			// 忽略
		}
	}
	if (hasH5Speech()) {
		try {
			window.speechSynthesis.cancel()
		} catch (e) {
			// 忽略
		}
	}
}
