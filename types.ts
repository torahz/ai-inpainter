
export interface InpaintState {
  originalImage: string | null;
  maskImage: string | null;
  resultImage: string | null;
  prompt: string;
  isProcessing: boolean;
  error: string | null;
}

export enum BrushMode {
  DRAW = 'DRAW',
  ERASE = 'ERASE'
}
