<h1 align="center">AI VOICE ASSISTANT</h1>
<p align="center"><em>Your intelligent voice-powered AI companion for natural conversations</em></p>

<p align="center">
  <a href="https://reactjs.org/"><img src="https://img.shields.io/badge/React-19.1-blue.svg" alt="React"></a>
  <a href="https://fastapi.tiangolo.com/"><img src="https://img.shields.io/badge/FastAPI-Latest-009688.svg" alt="FastAPI"></a>
  <a href="https://python.langchain.com/"><img src="https://img.shields.io/badge/LangChain-Latest-2496ED.svg" alt="LangChain"></a>
  <a href="https://cloud.google.com/text-to-speech"><img src="https://img.shields.io/badge/Google_TTS-Latest-4285F4.svg" alt="Google TTS"></a>
</p>

---

## 📍 Overview

**AI Voice Assistant** is a cutting-edge conversational AI platform that combines natural language processing with voice interaction capabilities. The platform enables users to have natural, voice-based conversations with an AI assistant that can understand context, remember conversation history, and respond with human-like speech.

The assistant leverages **LangChain for intelligent conversations, Google Cloud TTS for natural speech synthesis, and a modern React frontend** for an intuitive user experience.

🌐 **Live Demo**:


---

## 👾 Features

- **Advanced AI Model** → Powered by Google's Gemini 2.0 Flash model
- **Context Awareness** → Maintains conversation history for contextual responses
- **Text-to-Speech** → High-quality voice synthesis using Google Cloud TTS, with options of male and female voices.
- **Smart Response System** → Confident and precise answers with natural tone
- **Modern UI** → Clean, responsive React interface with real-time updates
- **Session Management** → Persistent conversation history for continuous interactions

---

## 🏗 Architecture

The system is divided into modular **frontend and backend services**:

- **Frontend Stack**:
  - React 19.1 with Vite for fast development
  - Tailwind CSS with Typography plugin
  - Framer Motion for smooth animations
  - Axios for API communication
  - React Markdown for text formatting

- **Backend Stack**:
  - FastAPI for high-performance API
  - LangChain & LangChain Community for AI processing
  - Google Cloud Text-to-Speech for voice synthesis
  - Session management for conversation persistence

- **Key Components**:
  - `app.py` → FastAPI application server
  - `chat.py` → Core conversation logic
  - `session_store.py` → Conversation history management

---

## 📁 Project Structure

```sh
└── AI-Voice-Assistant/
    ├── backend/
    │   ├── app.py           # FastAPI application entry point
    │   ├── chat.py          # Gemini AI and TTS integration
    │   ├── session_store.py # Conversation history management
    │   └── requirements.txt # Python dependencies
    └── frontend/
        ├── src/
        │   ├── App.jsx      # Main application component
        │   ├── ChatApp.jsx  # Chat interface component
        │   ├── App.css      # Application styles
        │   ├── index.css    # Global styles
        │   ├── main.jsx     # Application entry point
        │   └── assets/      # Static resources
        ├── public/          # Public assets
        ├── package.json     # Node.js dependencies
        ├── postcss.config.cjs   # PostCSS configuration
        ├── tailwind.config.cjs  # Tailwind CSS configuration
        └── vite.config.js       # Vite configuration
```

---

## 🚀 Getting Started

### ☑️ Prerequisites

Ensure your system has:

- **Python** 3.8 or higher
- **Node.js** 16.x or higher
- **Google Cloud Platform** account
- **Git** for version control

### ⚙️ Installation

1. Clone the repository:
```sh
❯ git clone "https://github.com/Adityajain8595/AI-Voice-Assistant"
❯ cd AI-Voice-Assistant
```

2. Set up backend:
```sh
❯ cd backend
❯ python -m venv venv
❯ venv\Scripts\activate  # On Windows
❯ pip install -r requirements.txt
```

3. Configure environment:
```sh
❯ # Create .env file with:
GCP_PROJECT_ID=your_project_id
GOOGLE_APPLICATION_CREDENTIALS=path_to_credentials.json
```

4. Set up frontend:
```sh
❯ cd ../frontend
❯ npm install

# Required dependencies:
# - React & React DOM v19.1
# - Framer Motion for animations
# - Tailwind CSS for styling
# - Axios for API requests
```

### 🎯 Running the Application

1. Start backend server:
```sh
❯ cd backend
❯ uvicorn app:app --reload
```

2. Launch frontend:
```sh
❯ cd frontend
❯ npm run dev
```

Access the application at:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`

---

<details closed>
<summary>Contributing Guidelines</summary>

1. **Fork the Repository**: Start by forking the project
2. **Clone Locally**: 
   ```sh
   git clone <repository-url>
   ```
3. **Create a Branch**: 
   ```sh
   git checkout -b feature/amazing-feature
   ```
4. **Make Changes**: Implement your feature or fix
5. **Test**: Ensure your changes work as expected
6. **Submit PR**: Push changes and create a Pull Request

</details>

---

## 📝 License

This project is licensed under the MIT License.
