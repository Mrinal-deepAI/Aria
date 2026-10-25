/**
 * Audio Matching Utilities
 * Uses FFT data from AnalyserNode as a heuristic for voice matching.
 */

// Calculate cosine similarity between two numeric arrays
export function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Store Voice Profile to LocalStorage
export function saveVoiceProfile(key: string, profile: number[]) {
  localStorage.setItem(`voice_profile_${key}`, JSON.stringify(profile));
}

// Load Voice Profile from LocalStorage
export function loadVoiceProfile(key: string): number[] | null {
  const data = localStorage.getItem(`voice_profile_${key}`);
  if (data) {
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error("Failed to parse voice profile", e);
      return null;
    }
  }
  return null;
}

// Helper to accumulate average frequency over time
export class AudioSignatureBuilder {
  private analyser: AnalyserNode;
  private dataArray: Uint8Array;
  private accumulator: Float32Array;
  private sampleCount: number = 0;
  private bufferLength: number;

  constructor(audioContext: AudioContext, source: AudioNode) {
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = 512; // Good balance for speech frequencies
    source.connect(this.analyser);
    
    // We only care about vocal frequencies (roughly 80Hz to 4000Hz)
    // With fftSize 512 at 44.1kHz, each bin is ~86Hz.
    // Bins 1 to 45 cover ~86Hz to ~3800Hz.
    this.bufferLength = 45; 
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.accumulator = new Float32Array(this.bufferLength);
  }

  // Call this repeatedly in a requestAnimationFrame loop while audio is playing
  public recordSample() {
    this.analyser.getByteFrequencyData(this.dataArray as any);
    
    // Only accumulate if there is actual audio (volume > threshold)
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i];
    }
    
    const avgVolume = sum / this.dataArray.length;
    if (avgVolume > 10) { // arbitrary noise gate
      // Only accumulate the vocal range bins (1 to 45)
      for (let i = 0; i < this.bufferLength; i++) {
        this.accumulator[i] += this.dataArray[i + 1];
      }
      this.sampleCount++;
    }
  }

  // Returns the normalized average signature
  public getSignature(): number[] {
    if (this.sampleCount === 0) return [];
    
    const signature = new Array(this.accumulator.length);
    for (let i = 0; i < this.accumulator.length; i++) {
      signature[i] = this.accumulator[i] / this.sampleCount;
    }
    return signature;
  }
  
  public reset() {
    this.accumulator.fill(0);
    this.sampleCount = 0;
  }
}
