import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pickEnglishVoice, speakEnglish, stopSpeaking } from './speak.ts'

function voice(name: string, lang = 'en-US', voiceURI = name): SpeechSynthesisVoice {
  return { name, lang, voiceURI, default: false, localService: true }
}

describe('standard English voice selection', () => {
  it('chooses human speech instead of the first en-US sound-effect voice', () => {
    const samantha = voice('Samantha')
    expect(
      pickEnglishVoice([
        voice('Bells'),
        voice('Cellos'),
        voice('Albert'),
        voice('Tingting', 'zh-CN'),
        samantha,
      ]),
    ).toBe(samantha)
  })

  it('accepts other English accents and identifies localized effect names by URI', () => {
    const daniel = voice('Daniel', 'en-GB')
    expect(
      pickEnglishVoice([voice('钟声', 'en-US', 'com.apple.speech.synthesis.voice.Bells'), daniel]),
    ).toBe(daniel)
    expect(pickEnglishVoice([voice('Bells'), voice('Tingting', 'zh-CN')])).toBeUndefined()
  })

  it('selects the requested US, UK or Australian accent without a silent substitution', () => {
    const voices = [voice('Samantha'), voice('Daniel', 'en-GB'), voice('Karen', 'en-AU')]
    expect(pickEnglishVoice(voices, 'en-US')?.name).toBe('Samantha')
    expect(pickEnglishVoice(voices, 'en-GB')?.name).toBe('Daniel')
    expect(pickEnglishVoice(voices, 'en-AU')?.name).toBe('Karen')
    expect(pickEnglishVoice([voice('Samantha')], 'en-GB')).toBeUndefined()
  })
})

describe('speech lifecycle', () => {
  let voices: SpeechSynthesisVoice[]
  let listeners: Set<() => void>
  let spoken: Array<{
    text: string
    voice: SpeechSynthesisVoice
    rate: number
    onend?: () => void
    onerror?: (event: { error: string }) => void
  }>
  let synth: {
    getVoices: () => SpeechSynthesisVoice[]
    speak: ReturnType<typeof vi.fn>
    cancel: ReturnType<typeof vi.fn>
    resume: ReturnType<typeof vi.fn>
    addEventListener: ReturnType<typeof vi.fn>
    removeEventListener: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    vi.useFakeTimers()
    voices = [voice('Cellos'), voice('Samantha')]
    listeners = new Set()
    spoken = []
    synth = {
      getVoices: () => voices,
      speak: vi.fn((utterance) => {
        spoken.push(utterance)
      }),
      cancel: vi.fn(),
      resume: vi.fn(),
      addEventListener: vi.fn((_event, callback) => listeners.add(callback)),
      removeEventListener: vi.fn((_event, callback) => listeners.delete(callback)),
    }
    vi.stubGlobal('window', { speechSynthesis: synth, setTimeout, clearTimeout })
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        text: string
        constructor(text: string) {
          this.text = text
        }
      },
    )
  })

  afterEach(() => {
    stopSpeaking()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('speaks the actual word with a standard human voice', async () => {
    const result = speakEnglish(' apple ')
    await vi.advanceTimersByTimeAsync(50)
    expect(spoken[0]?.text).toBe('apple')
    expect(spoken[0]?.voice.name).toBe('Samantha')
    spoken[0]?.onend?.()
    await expect(result).resolves.toBeUndefined()
  })

  it('uses the selected rate when speaking and retains the default for old preferences', async () => {
    const slow = speakEnglish('apple', 'en-US', 0.7)
    await vi.advanceTimersByTimeAsync(50)
    expect(spoken[0]?.rate).toBe(0.7)
    spoken[0]?.onend?.()
    await slow
    const normal = speakEnglish('book')
    await vi.advanceTimersByTimeAsync(50)
    expect(spoken[1]?.rate).toBe(0.9)
    spoken[1]?.onend?.()
    await normal
  })

  it('does not start stale audio after moving to another card', async () => {
    const result = speakEnglish('apple')
    stopSpeaking()
    await vi.runAllTimersAsync()
    expect(spoken).toHaveLength(0)
    await expect(result).resolves.toBeUndefined()
  })

  it('cancels a pending voice load and removes its listener', async () => {
    voices = []
    const result = speakEnglish('apple')
    expect(listeners.size).toBe(1)
    stopSpeaking()
    voices = [voice('Samantha')]
    for (const listener of listeners) listener()
    await vi.runAllTimersAsync()
    expect(listeners.size).toBe(0)
    expect(spoken).toHaveLength(0)
    await expect(result).resolves.toBeUndefined()
  })

  it('waits for asynchronously loaded voices', async () => {
    voices = []
    const result = speakEnglish('apple')
    voices = [voice('Samantha')]
    for (const listener of [...listeners]) listener()
    await vi.advanceTimersByTimeAsync(50)
    expect(spoken[0]?.voice.name).toBe('Samantha')
    spoken[0]?.onend?.()
    await result
    expect(listeners.size).toBe(0)
  })

  it('reports the absence of a standard English voice instead of playing an effect', async () => {
    voices = [voice('Cellos')]
    await expect(speakEnglish('apple')).rejects.toThrow('标准英文语音')
    expect(spoken).toHaveLength(0)
  })

  it('cancels the previous request when another word is played quickly', async () => {
    const first = speakEnglish('apple')
    const second = speakEnglish('book')
    await vi.advanceTimersByTimeAsync(50)
    expect(spoken.map((utterance) => utterance.text)).toEqual(['book'])
    spoken[0]?.onend?.()
    await Promise.all([first, second])
  })

  it('plays the selected accent and reports an unavailable accent clearly', async () => {
    voices = [voice('Samantha'), voice('Daniel', 'en-GB')]
    const result = speakEnglish('apple', 'en-GB')
    await vi.advanceTimersByTimeAsync(50)
    expect(spoken[0]?.voice.name).toBe('Daniel')
    spoken[0]?.onend?.()
    await result
    await expect(speakEnglish('apple', 'en-AU')).rejects.toThrow('澳式英语')
  })
})
