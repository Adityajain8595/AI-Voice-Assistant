import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const DEFAULT_BACKEND = "https://ai-voice-assistant-1-5oox.onrender.com";
const markdownStripRegex = /(\*+|#+)/g;

const MicSVG = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M5 11a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M12 18v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const Switch = ({ option1, option2, value, onChange }) => {
  const isSelected = value === option2.value;
  return (
    <div
      onClick={() => onChange(isSelected ? option1.value : option2.value)}
      className="relative w-full h-10 flex items-center rounded-full bg-white/10 p-1 cursor-pointer transition-colors hover:bg-white/15"
    >
      <motion.div
        className="absolute h-8 rounded-full bg-emerald-500 shadow-md"
        initial={{ left: isSelected ? '50%' : '0' }}
        animate={{ left: isSelected ? '50%' : '0' }}
        transition={{ type: "spring", stiffness: 700, damping: 30 }}
        style={{ width: 'calc(50% - 4px)' }}
      />
      <div className="z-10 w-1/2 text-center text-sm font-medium">
        <span className={`transition-colors ${!isSelected ? 'text-white' : 'text-white/50'}`}>{option1.label}</span>
      </div>
      <div className="z-10 w-1/2 text-center text-sm font-medium">
        <span className={`transition-colors ${isSelected ? 'text-white' : 'text-white/50'}`}>{option2.label}</span>
      </div>
    </div>
  );
};

function useOutputAnalyser() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bars, setBars] = useState(Array(48).fill(0));
  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);

  const playBlob = async (blob) => {
    // Check if blob is valid
    if (!blob || blob.size === 0) {
      console.error("Received empty audio blob");
      return;
    }
    
    console.log("Audio blob details:", {
      size: blob.size,
      type: blob.type,
    });

    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const arrayBuf = await blob.arrayBuffer();
      
      // Use the promise-based decodeAudioData
      const audioBuf = await ctx.decodeAudioData(arrayBuf);
      
      // Resume audio context if needed (required for autoplay policies)
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      
      const source = ctx.createBufferSource();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      source.buffer = audioBuf;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      source.start();

      audioCtxRef.current = ctx;
      sourceRef.current = source;
      analyserRef.current = analyser;
      dataArrayRef.current = dataArray;
      setIsPlaying(true);

      source.onended = () => {
        setTimeout(() => {
          setIsPlaying(false);
          setBars(Array(48).fill(0));
        }, 50);
        
        // Cleanup
        try { 
          analyser.disconnect(); 
          source.disconnect(); 
          ctx.close(); 
        } catch (e) {
          console.warn("Cleanup error:", e);
        }
        
        audioCtxRef.current = null;
        sourceRef.current = null;
        analyserRef.current = null;
        dataArrayRef.current = null;
      };
      
    } catch (error) {
      console.error("Error playing audio:", error);
      setIsPlaying(false);
    }
  };

  useEffect(() => {
    if (!isPlaying) {
      setBars(Array(48).fill(0));
      return;
    }
    
    let raf;
    const tick = () => {
      const analyser = analyserRef.current;
      const arr = dataArrayRef.current;
      if (!analyser || !arr) return;
      analyser.getByteFrequencyData(arr);
      const columns = 48;
      const bucket = Math.floor(arr.length / columns);
      const next = new Array(columns).fill(0).map((_, i) => {
        let m = 0;
        for (let j = i * bucket; j < (i + 1) * bucket; j++) m = Math.max(m, arr[j] || 0);
        return Math.max(0, Math.round((m / 255) * 80));
      });
      setBars(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  return { isPlaying, bars, playBlob };
}

function beep(open = true) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = open ? 880 : 520;
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.start();
    osc.stop(now + 0.18);
    osc.onended = () => ctx.close();
  } catch (e) {
    console.warn("Beep failed:", e);
  }
}

function speakWithBrowserTTS(text, voice = "female", lang = "en-US") {
  if (!('speechSynthesis' in window)) {
    console.error("Browser TTS not supported");
    return false;
  }
  
  // Cancel any ongoing speech
  window.speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 1.0;
  utterance.pitch = voice === "male" ? 0.8 : 1.1;
  utterance.volume = 1.0;
  
  // Try to set voice based on gender preference
  const voices = speechSynthesis.getVoices();
  const preferredVoices = voices.filter(v => 
    v.lang.startsWith(lang) &&
    (voice === "male" ? v.name.toLowerCase().includes("male") || v.name.toLowerCase().includes("man") : 
                        v.name.toLowerCase().includes("female") || v.name.toLowerCase().includes("woman"))
  );
  
  if (preferredVoices.length > 0) {
    utterance.voice = preferredVoices[0];
  }
  
  window.speechSynthesis.speak(utterance);
  return true;
}

export default function VoiceAssistant({ backendUrl = DEFAULT_BACKEND, sessionId = "default_session" }) {
  const [recording, setRecording] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  const [status, setStatus] = useState("Tap to talk");
  const [assistantText, setAssistantText] = useState("");
  const [userText, setUserText] = useState("");
  const [showTextBox, setShowTextBox] = useState(false);
  const [history, setHistory] = useState([]);
  const [voice, setVoice] = useState("female");
  const [useBrowserTTS, setUseBrowserTTS] = useState(false);
  const [backendStatus, setBackendStatus] = useState("Checking...");
  const recognitionRef = useRef(null);

  const { isPlaying, bars, playBlob } = useOutputAnalyser();
  const [volume, setVolume] = useState(0);
  const language = "en";

  // Helper function to build URLs without double slashes
  const buildUrl = (endpoint) => {
    // Remove trailing slash from backendUrl if it exists
    const base = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;
    // Remove leading slash from endpoint if it exists
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${base}${path}`;
  };

  // Test backend connection on mount
  useEffect(() => {
    const testBackend = async () => {
      try {
        // Test if backend is reachable
        const testUrl = buildUrl("");
        console.log("Testing backend at:", testUrl);
        
        const testRes = await fetch(testUrl, {
          method: 'GET',
        });
        
        if (testRes.ok) {
          setBackendStatus("Connected");
          
          // Test TTS endpoint specifically
          const ttsUrl = buildUrl("tts");
          console.log("Testing TTS at:", ttsUrl);
          
          const ttsBody = new URLSearchParams();
          ttsBody.set("text", "Test");
          ttsBody.set("lang", language);
          ttsBody.set("voice", voice);
          
          const ttsRes = await fetch(ttsUrl, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: ttsBody
          });
          
          console.log("TTS test response status:", ttsRes.status);
          
          if (ttsRes.ok) {
            const blob = await ttsRes.blob();
            console.log("TTS test successful, blob:", blob);
            setBackendStatus("TTS working");
          } else {
            console.warn(`TTS test failed: ${ttsRes.status}`);
            setBackendStatus("TTS endpoint error");
            setUseBrowserTTS(true);
          }
        } else {
          setBackendStatus("Backend unreachable");
          setUseBrowserTTS(true);
        }
      } catch (error) {
        console.error("Backend test failed:", error);
        setBackendStatus("Connection failed");
        setUseBrowserTTS(true);
      }
    };
    
    testBackend();
  }, [backendUrl, language, voice]);

  const startRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setAssistantText("Speech recognition is not supported in this browser.");
      setStatus("Not supported");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setRecording(true);
      setStatus("Listening…");
      beep(true);
      setVolume(1);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setUserText(transcript);
      sendToTalk(transcript);
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        setMicDenied(true);
        setStatus("Microphone blocked");
      } else if (event.error === 'no-speech') {
        setAssistantText("I didn't hear anything. Please try again.");
      } else {
        setAssistantText(`Recognition error: ${event.error}`);
      }
      stopRecognition();
    };

    recognition.onend = () => {
      stopRecognition();
    };
    
    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setRecording(false);
    setVolume(0);
    setStatus("Tap to talk");
    beep(false);
  };

  const sendToTalk = async (query) => {
    if (!query.trim()) {
      setAssistantText("I didn't catch that. Please speak again.");
      return;
    }
    setStatus("Thinking…");
    try {
      const askUrl = buildUrl("ask");
      console.log("Sending to ask endpoint:", askUrl);
      
      const body = new URLSearchParams();
      body.set("query", query);
      body.set("session_id", sessionId);
      
      const res = await fetch(askUrl, { 
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
        }, 
        body 
      });
      
      if (!res.ok) {
        throw new Error(`Ask request failed: ${res.status} ${res.statusText}`);
      }
      
      const json = await res.json();
      const rawAnswer = json.answer || "";
      const cleanedAnswer = rawAnswer.replace(markdownStripRegex, '');

      setAssistantText(cleanedAnswer);
      setHistory(json.chat_history || []);
      
      // Try backend TTS if enabled
      if (!useBrowserTTS && cleanedAnswer.trim()) {
        try {
          const ttsUrl = buildUrl("tts");
          console.log("Requesting TTS from:", ttsUrl);
          
          const ttsBody = new URLSearchParams();
          ttsBody.set("text", cleanedAnswer);
          ttsBody.set("lang", language);
          ttsBody.set("voice", voice);
          
          const ttsRes = await fetch(ttsUrl, { 
            method: 'POST', 
            headers: { 
              'Content-Type': 'application/x-www-form-urlencoded',
            }, 
            body: ttsBody 
          });
          
          console.log("TTS response status:", ttsRes.status);
          
          if (ttsRes.ok) {
            const ttsBlob = await ttsRes.blob();
            
            console.log("Received audio blob:", {
              size: ttsBlob.size,
              type: ttsBlob.type
            });
            
            if (ttsBlob && ttsBlob.size > 0) {
              await playBlob(ttsBlob);
              setStatus("Speaking…");
              return;
            } else {
              console.warn("Empty audio blob received");
            }
          } else {
            console.error(`Backend TTS returned ${ttsRes.status}`);
            setBackendStatus(`TTS failed: ${ttsRes.status}`);
          }
        } catch (ttsError) {
          console.error("Backend TTS request error:", ttsError);
          setBackendStatus("TTS request error");
        }
      }
      
      // Fall back to browser TTS if backend TTS failed or is disabled
      if (cleanedAnswer.trim() && speakWithBrowserTTS(cleanedAnswer, voice, "en-US")) {
        setStatus("Speaking… (Browser TTS)");
        setTimeout(() => {
          setStatus("Tap to talk");
        }, 3000);
      } else {
        setStatus("Tap to talk");
      }
      
    } catch (e) {
      console.error("Error in sendToTalk:", e);
      setAssistantText(`Error: ${e.message}. Using browser TTS as fallback.`);
      
      // Try browser TTS as last resort
      if (userText.trim() && speakWithBrowserTTS(userText, voice, "en-US")) {
        setStatus("Speaking… (Fallback)");
      } else {
        setStatus("Tap to talk");
      }
    } finally {
      setUserText("");
    }
  };

  const handleMicClick = () => {
    if (recording) {
      stopRecognition();
    } else {
      startRecognition();
    }
  };

  const handleAskText = () => {
    if (!userText.trim()) return;
    sendToTalk(userText);
  };

  const toggleTTSMethod = () => {
    const newUseBrowserTTS = !useBrowserTTS;
    setUseBrowserTTS(newUseBrowserTTS);
    setBackendStatus(newUseBrowserTTS ? "Using browser TTS" : "Using backend TTS");
  };

  const testBackendConnection = async () => {
    setBackendStatus("Testing...");
    try {
      const ttsUrl = buildUrl("tts");
      console.log("Testing TTS endpoint:", ttsUrl);
      
      const ttsBody = new URLSearchParams();
      ttsBody.set("text", "Test message from frontend");
      ttsBody.set("lang", language);
      ttsBody.set("voice", voice);
      
      const response = await fetch(ttsUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: ttsBody
      });
      
      console.log("TTS test response status:", response.status);
      
      if (response.ok) {
        const blob = await response.blob();
        console.log("TTS test successful, blob:", blob);
        setBackendStatus("Backend TTS working");
        setUseBrowserTTS(false);
        // Test play the audio
        if (blob) {
          await playBlob(blob);
        }
      } else {
        const errorText = await response.text();
        console.error("TTS test failed:", errorText);
        setBackendStatus(`TTS failed: ${response.status}`);
        setUseBrowserTTS(true);
      }
    } catch (error) {
      console.error("TTS test error:", error);
      setBackendStatus(`Error: ${error.message}`);
      setUseBrowserTTS(true);
    }
  };

  const ringScale = useMemo(() => 1 + volume * 0.25, [volume]);
  const ringOpacity = useMemo(() => 0.35 + volume * 0.4, [volume]);

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-slate-950 via-slate-900 to-zinc-900 text-slate-100 flex items-center justify-center p-2 md:p-4 overflow-hidden">
      <div className="flex flex-col md:flex-row gap-6 w-full h-full max-w-[1600px] mx-auto">
        
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">AI Voice Assistant</h1>
            <div className="text-xs opacity-70">Session: <span className="font-mono">{sessionId}</span></div>
          </div>

          <div className="relative rounded-2xl bg-white/5 backdrop-blur-xl ring-1 ring-white/10 p-6 shadow-2xl overflow-hidden">
            
            <div className="mb-2">
              <div className="text-xs text-slate-400 mb-1 flex items-center justify-between">
                <span>Backend: {backendUrl}</span>
                <span className={`px-2 py-0.5 rounded ${
                  backendStatus.includes("working") || backendStatus.includes("Connected")
                    ? 'bg-emerald-500/20 text-emerald-300' 
                    : 'bg-amber-500/20 text-amber-300'
                }`}>
                  {backendStatus}
                </span>
              </div>
            </div>
            
            <div className="mb-8">
              <div className="text-center mt-3 text-sm md:text-base text-slate-300 min-h-[1.5rem]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={assistantText}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                    className="px-3"
                  >
                    {assistantText || <span className="opacity-50">Assistant will speak here…</span>}
                  </motion.div>
                </AnimatePresence>
              </div>
              <div className="h-24 md:h-28 w-full flex items-center justify-center gap-[6px] mt-4">
                {bars.map((h, i) => (
                  <div
                    key={i}
                    className="w-[6px] rounded-full bg-gradient-to-t from-emerald-400/40 via-emerald-300/70 to-emerald-100"
                    style={{ height: `${h}px` }} 
                    aria-hidden
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col items-center gap-4 py-4">
              <div className="relative">
                <motion.div
                  className="absolute inset-[-28px] rounded-full bg-emerald-500/10 blur-xl"
                  animate={{ opacity: recording ? [0.3, 0.55, 0.3] : ringOpacity }}
                  transition={{ 
                    duration: recording ? 1.6 : 0.2, 
                    repeat: recording ? Infinity : 0, 
                    type: recording ? 'tween' : 'spring', 
                    stiffness: 300, 
                    damping: 20 
                  }}
                />

                <motion.div
                  className="absolute inset-[-18px] rounded-full border border-emerald-400/30"
                  style={{ transformOrigin: 'center' }}
                  animate={{ scale: ringScale }}
                  transition={{ type: 'spring', stiffness: 140, damping: 18 }}
                />
                <motion.div
                  className="absolute inset-[-36px] rounded-full border border-emerald-400/20"
                  style={{ transformOrigin: 'center' }}
                  animate={{ scale: 1 + volume * 0.45 }}
                  transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                />

                <button
                  onClick={handleMicClick}
                  className={`relative z-10 h-24 w-24 md:h-28 md:w-28 rounded-full grid place-items-center select-none transition-all 
                    ${recording ? 'bg-emerald-500 shadow-[0_0_0_6px_rgba(16,185,129,0.35)]' : 'bg-emerald-600 hover:bg-emerald-500'}
                    text-white`}
                  aria-pressed={recording}
                  aria-label={recording ? 'Stop recording' : 'Start recording'}
                >
                  <div className="absolute inset-0 rounded-full ring-2 ring-white/40" />
                  <div className="absolute -inset-[6px] rounded-full bg-emerald-500/20 blur-lg" />
                  <MicSVG />
                </button>
              </div>

              <div className="text-xs md:text-sm text-slate-300">
                {status}
                {micDenied && <span className="text-rose-300"> — allow mic permissions</span>}
              </div>

              <div className="flex flex-wrap gap-2 justify-center">
                <button
                  onClick={() => setShowTextBox((s) => !s)}
                  className="px-3 py-1.5 text-xs rounded-full border border-white/15 bg-white/5 hover:bg-white/10 transition" 
                >
                  {showTextBox ? "Hide text input" : "Use text instead"}
                </button>
                
                <button
                  onClick={toggleTTSMethod}
                  className={`px-3 py-1.5 text-xs rounded-full border transition ${
                    useBrowserTTS 
                      ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200' 
                      : 'border-white/15 bg-white/5 hover:bg-white/10'
                  }`}
                  title={useBrowserTTS ? "Using Browser TTS" : "Using Backend TTS"}
                >
                  TTS: {useBrowserTTS ? "Browser" : "Backend"}
                </button>
                
                <button
                  onClick={testBackendConnection}
                  className="px-3 py-1.5 text-xs rounded-full border border-blue-400/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-200 transition"
                  title="Test backend connection"
                >
                  Test TTS
                </button>
              </div>

              <AnimatePresence initial={false}>
                {showTextBox && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="w-full"
                  >
                    <div className="mt-2 flex gap-2">
                      <input
                        value={userText}
                        onChange={(e) => setUserText(e.target.value)}
                        placeholder="Type your message…"
                        onKeyDown={(e) => e.key === 'Enter' && handleAskText()}
                        className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-emerald-400/60 focus:bg-white/10 placeholder:text-slate-400 text-slate-100"
                      />
                      <button
                        onClick={handleAskText}
                        className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-lg"
                      >
                        Send
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="w-full mt-4">
                <Switch
                  option1={{ label: "Female", value: "female" }}
                  option2={{ label: "Male", value: "male" }}
                  value={voice}
                  onChange={setVoice}
                />
              </div>

            </div>

            <div className="mt-6">
              <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Recent</div>
              <div className="max-h-40 overflow-y-auto pr-1 space-y-1">
                {history.slice(-8).map((m, i) => (
                  <div key={i} className="text-xs text-slate-300">
                    <span className={`px-1.5 py-0.5 rounded ${m.role === 'ai' ? 'bg-emerald-500/10 text-emerald-200' : 'bg-white/5'}`}>{m.role}</span>
                    <span className="ml-2 opacity-80">{typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}</span>
                  </div>
                ))}
                {!history.length && <div className="text-xs opacity-50">Conversations will appear here…</div>}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}