import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const DEFAULT_BACKEND = "https://ai-voice-assistant-s07k.onrender.com";
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
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuf = await blob.arrayBuffer();
    const audioBuf = await ctx.decodeAudioData(arrayBuf);
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
      try { analyser.disconnect(); } catch {}
      try { source.disconnect(); } catch {}
      try { ctx.close(); } catch {}
    };
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
  const recognitionRef = useRef(null);

  const { isPlaying, bars, playBlob } = useOutputAnalyser();
  const [volume, setVolume] = useState(0);
  const language = "en-US";

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
    recognition.lang = language;

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
      const body = new URLSearchParams();
      body.set("query", query);
      body.set("session_id", sessionId);
      const res = await fetch(`${backendUrl}/ask`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, 
        body 
      });
      const json = await res.json();
      const rawAnswer = json.answer || "";
      const cleanedAnswer = rawAnswer.replace(markdownStripRegex, '');

      setAssistantText(cleanedAnswer);
      setHistory(json.chat_history || []);
      const ttsBody = new URLSearchParams();
      ttsBody.set("text", cleanedAnswer);
      ttsBody.set("lang", language);
      ttsBody.set("voice", voice);
      const ttsRes = await fetch(`${backendUrl}/tts`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, 
        body: ttsBody 
      });
      const ttsBlob = await ttsRes.blob();
      await playBlob(ttsBlob);
    } catch (e) {
      setAssistantText(e.message);
      setStatus("Tap to talk");
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

              <button
                onClick={() => setShowTextBox((s) => !s)}
                className="px-3 py-1.5 text-xs rounded-full border border-white/15 bg-white/5 hover:bg-white/10 transition" 
              >
                {showTextBox ? "Hide text input" : "Use text instead"}
              </button>

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