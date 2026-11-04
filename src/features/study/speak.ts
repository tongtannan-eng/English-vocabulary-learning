import { isSpeechRate, loadSpeechRate } from '../../services/speechRate.ts'
import type { SpeechRate } from '../../services/speechRate.ts'
import type { SpeechAccent } from '../../shared/types.ts'

export const SPEECH_ACCENTS: ReadonlyArray<{ value: SpeechAccent; label: string; short: string }> =
  [
    { value: 'en-US', label: '美式英语', short: '美音' },
    { value: 'en-GB', label: '英式英语', short: '英音' },
    { value: 'en-AU', label: '澳式英语', short: '澳音' },
  ]

// macOS exposes musical/effect voices as en-US too. Never choose by locale alone.
const EFFECT_VOICES = new Set([
  'albert',
  'badnews',
  'bahh',
  'bells',
  'boing',
  'bubbles',
  'cellos',
  'deranged',
  'goodnews',
  'hysterical',
  'jester',
  'organ',
  'pipeorgan',
  'trinoids',
  'whisper',
  'wobble',
  'zarvox',
])
const HUMAN_VOICES = [
  /samantha/i,
  /google.*(?:us english|english.*united states)/i,
  /microsoft.*(?:aria|jenny|guy|zira|david)/i,
  /siri/i,
  /\balex\b/i,
  /daniel/i,
  /karen/i,
  /moira/i,
  /tessa/i,
]

let cancelPending: (() => void) | undefined
// Keep a strong reference while speaking, including in Safari.
let currentUtterance: SpeechSynthesisUtterance | undefined

export function pickEnglishVoice(
  voices: readonly SpeechSynthesisVoice[],
  accent?: SpeechAccent,
): SpeechSynthesisVoice | undefined {
  const normalizedName = (value: string) => value.toLowerCase().replace(/[^a-z]/g, '')
  const english = voices.filter((voice) => {
    if (!/^en(?:[-_]|$)/i.test(voice.lang)) return false
    if (accent && voice.lang.replace('_', '-').toLowerCase() !== accent.toLowerCase()) return false
    const uriName = voice.voiceURI.split('.').at(-1) ?? ''
    return (
      !EFFECT_VOICES.has(normalizedName(voice.name)) && !EFFECT_VOICES.has(normalizedName(uriName))
    )
  })
  function score(voice: SpeechSynthesisVoice): number {
    const preferred = HUMAN_VOICES.findIndex((pattern) => pattern.test(voice.name))
    return (
      (preferred < 0 ? 0 : 100 - preferred * 4) +
      (/^en[-_]US$/i.test(voice.lang) ? 20 : 0) +
      (/natural|premium|enhanced/i.test(voice.name) ? 10 : 0) +
      (voice.default ? 5 : 0)
    )
  }
  return [...english].sort((a, b) => score(b) - score(a))[0]
}

export function speakEnglish(
  text: string,
  accent: SpeechAccent = 'en-US',
  rate: SpeechRate = loadSpeechRate(),
): Promise<void> {
  stopSpeaking()
  const word = text.trim()
  if (!word) return Promise.resolve()
  const synth = window.speechSynthesis
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
    return Promise.reject(new Error('当前浏览器不支持英文朗读，请换用支持语音的浏览器。'))
  }

  return new Promise<void>((resolve, reject) => {
    let settled = false
    let voicesTimer: number | undefined
    let startTimer: number | undefined
    let utterance: SpeechSynthesisUtterance | undefined

    function finish(error?: Error) {
      if (settled) return
      settled = true
      window.clearTimeout(voicesTimer)
      window.clearTimeout(startTimer)
      synth.removeEventListener('voiceschanged', onVoices)
      if (utterance) {
        utterance.onend = null
        utterance.onerror = null
      }
      if (currentUtterance === utterance) currentUtterance = undefined
      if (cancelPending === cancel) cancelPending = undefined
      if (error) reject(error)
      else resolve()
    }

    const cancel = () => finish()
    cancelPending = cancel

    function start() {
      if (settled || utterance) return
      const voice = pickEnglishVoice(synth.getVoices(), accent)
      if (!voice) {
        const label = SPEECH_ACCENTS.find((item) => item.value === accent)?.label ?? '英语'
        finish(
          new Error(`没有可用的${label}标准英文语音，请在系统设置中添加对应语音，或切换其他发音。`),
        )
        return
      }
      window.clearTimeout(voicesTimer)
      synth.removeEventListener('voiceschanged', onVoices)
      utterance = new SpeechSynthesisUtterance(word)
      utterance.voice = voice
      utterance.lang = voice.lang.replace('_', '-')
      utterance.rate = isSpeechRate(rate) ? rate : 0.9
      utterance.pitch = 1
      utterance.volume = 1
      utterance.onend = () => finish()
      utterance.onerror = (event) => {
        finish(
          event.error === 'interrupted' || event.error === 'canceled'
            ? undefined
            : new Error('朗读失败，请检查系统英语语音是否可用，然后重试。'),
        )
      }
      currentUtterance = utterance
      // Allow cancel() to settle before a new utterance starts.
      startTimer = window.setTimeout(() => {
        if (settled || !utterance) return
        try {
          synth.resume()
          synth.speak(utterance)
        } catch {
          finish(new Error('朗读失败，请稍后重试。'))
        }
      }, 50)
    }

    function onVoices() {
      if (synth.getVoices().length > 0) start()
    }

    if (synth.getVoices().length > 0) start()
    else {
      synth.addEventListener('voiceschanged', onVoices)
      voicesTimer = window.setTimeout(start, 1500)
    }
  })
}

export function stopSpeaking(): void {
  cancelPending?.()
  cancelPending = undefined
  currentUtterance = undefined
  window.speechSynthesis?.cancel()
}
