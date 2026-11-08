const PATTERNS = [
	/自杀/,
	/自残/,
	/自伤/,
	/轻生/,
	/不想活/,
	/活不下去/,
	/结束(自己|生命)/,
	/跳(楼|桥|河)/,
	/想死(?!你)/,
	/死了算了/,
	/活着没(有)?意思/
]

export function detectCrisis(text) {
	if (!text) return false
	const value = String(text)
	return PATTERNS.some(pattern => pattern.test(value))
}
