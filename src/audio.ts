export class TrainAudio {
  private context = new AudioContext();

  resume() {
    void this.context.resume();
  }

  play(type: 'horn' | 'chime', muted: boolean) {
    if (muted || this.context.state === 'suspended') return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type === 'horn' ? 'sawtooth' : 'sine';
    oscillator.frequency.value = type === 'horn' ? 360 : 880;
    gain.gain.setValueAtTime(.035, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, this.context.currentTime + (type === 'horn' ? .55 : .28));
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start();
    oscillator.stop(this.context.currentTime + (type === 'horn' ? .55 : .28));
  }
}
