export const MOODS = [
	{ id: 'anxious', label: '焦虑', bg: '#EFE6DC', fg: '#8C6448' },
	{ id: 'low', label: '低落', bg: '#E4E9EC', fg: '#4F6B7A' },
	{ id: 'sleep', label: '失眠', bg: '#E7E4EF', fg: '#5C567F' },
	{ id: 'friction', label: '摩擦', bg: '#F0E3E0', fg: '#8F5B4E' },
	{ id: 'social', label: '社交', bg: '#E3EBE6', fg: '#4E6E5C' },
	{ id: 'tired', label: '疲惫', bg: '#ECE9E2', fg: '#6E6759' }
]

export const PRESET_ECHOES = ['我在', '抱抱你', '慢慢来', '你不是一个人', '今天辛苦了']

export function moodOf(id) {
	return MOODS.find(item => item.id === id) || MOODS[0]
}
