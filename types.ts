
export interface Lesson {
  id: string;
  title: string;
  description: string;
  focus: 'shapes' | 'anatomy' | 'perspective' | 'lighting' | 'gesture';
}

export interface TranscriptionItem {
  text: string;
  type: 'user' | 'ai';
  timestamp: number;
}
