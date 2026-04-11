/** Короткий сигнал по окончании помодоро (без внешних файлов). */
export function playPomodoroChime() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.06, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28)
    osc.start()
    osc.stop(ctx.currentTime + 0.3)
    window.setTimeout(() => void ctx.close(), 400)
  } catch {
    /* autoplay / AudioContext */
  }
}
