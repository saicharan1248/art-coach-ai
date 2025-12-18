# 🎨 AI Art Coach

A world-class, real-time personal art mentor powered by Google Gemini 2.5. AI Coach provides proactive audio feedback and technical analysis as you draw, helping you master the fundamentals of art.

## 🚀 Features

- **Dual Tracking Modes**:
  - **Digital Studio**: Draw directly on an high-precision internal canvas.
  - **Physical Workspace**: Use your webcam to track your physical sketchbook, iPad, or canvas.
- **Proactive Audio Coaching**: The AI doesn't just wait for you to talk; it provides a running commentary on your line quality, anatomy, and perspective.
- **Fundamental Workshops**: Specific lessons for Shape Language, Human Anatomy, Dynamic Gesture, and Perspective.
- **Live Transcription**: Keep track of the mentor's technical advice in a scrolling feedback log.
- **Low-Latency Interaction**: Powered by the Gemini Live API for near-instant responses.

## 🛠️ Tech Stack

- **Frontend**: React 19, Tailwind CSS
- **AI Engine**: Google Generative AI (Gemini 2.5 Flash Native Audio)
- **API**: Gemini Live API (WebSockets)
- **Audio**: Web Audio API (PCM Processing)

## 🚦 Getting Started

### Prerequisites
- A Google Gemini API Key (get one at [ai.google.dev](https://ai.google.dev/))
- A modern web browser with Microphone and Camera permissions enabled.

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/art-coach-ai.git
   ```
2. Open the directory and serve the files using a local server (like Live Server or Vite).
3. Ensure your `process.env.API_KEY` is configured in your environment.

## 📖 How to Use
1. **Choose a Mode**: Select between Digital Studio or Physical Workspace.
2. **Select a Lesson**: Pick a focus area (e.g., Anatomy) from the Library.
3. **Start Session**: Click "Start Coaching".
4. **Draw & Listen**: Start drawing. The AI Coach will begin analyzing your strokes and speaking feedback to you. You can speak back to ask questions like "Is my vanishing point correct?"

## 📝 License
MIT License. Feel free to use and improve!
