import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Camera, MessageSquare, BookOpen, Settings, Send, User, ChevronRight, Play } from "lucide-react";
import { cn } from "./lib/utils";
import { ai, MODELS } from "./lib/gemini";

// --- Components ---

const SignToText = ({ onBack }: { onBack: () => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [translation, setTranslation] = useState<string>("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accuracy, setAccuracy] = useState<"fast" | "balanced" | "high">("balanced");

  const [isPaused, setIsPaused] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  const getAccuracyConfig = () => {
    switch (accuracy) {
      case "fast":
        return { model: MODELS.flash, interval: 10000, label: "Tezkor", desc: "Tez, lekin kamroq aniq", perf: "6 RPM" };
      case "high":
        return { model: MODELS.pro, interval: 45000, label: "Aniq", desc: "Eng yuqori aniqlik", perf: "1.3 RPM" };
      default:
        return { model: MODELS.flash, interval: 20000, label: "Muvozanat", desc: "Optimal ishlash", perf: "3 RPM" };
    }
  };

  const config = getAccuracyConfig();
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        setError("Kameraga ruxsat berilmadi.");
      }
    };
    startCamera();
    return () => {
      stream?.getTracks().forEach(track => track.stop());
    };
  }, []);

  const captureAndTranslate = async () => {
    if (!videoRef.current || !canvasRef.current || isCapturing) return;
    setIsCapturing(true);

    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (video.videoWidth === 0) {
      setIsCapturing(false);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const base64Image = canvas.toDataURL("image/jpeg").split(",")[1];

    try {
      const response = await (ai as any).models.generateContent({
        model: config.model,
        contents: [
          {
            parts: [
              { text: "Sen O'zbek imo-ishora tili (UZL) bo'yicha eng kuchli ekspert va tarjimonsan. Ushbu rasmdagi qo'l harakatini O'zbek imo-ishora tili (UZL) qoidalariga va o'zbekcha aksentga asoslanib aniq tarjima qil. Faqatgina tarjima qilingan so'z yoki qisqa gapning o'zini qaytar, ortiqcha izoh yozma." },
              { inlineData: { mimeType: "image/jpeg", data: base64Image } }
            ]
          }
        ]
      });
      setTranslation(response.text || "...");
      setQuotaExceeded(false);
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes("429") || err.message?.includes("quota") || err.status === 429) {
        setQuotaExceeded(true);
        setCooldown(30); // 30 seconds cooldown
        setTranslation("AI Limiti tugadi. Biroz kuting.");
      }
    } finally {
      setIsCapturing(false);
    }
  };

  useEffect(() => {
    if (isPaused || quotaExceeded) return;
    const interval = setInterval(() => {
      captureAndTranslate();
    }, config.interval);
    return () => clearInterval(interval);
  }, [config.interval, accuracy, isPaused, quotaExceeded]);

  return (
    <div className="flex-1 flex flex-col p-3 space-y-3 relative z-10 overflow-y-auto pb-24">
      <div className="flex items-center justify-between mb-1">
        <button onClick={onBack} className="p-2 bg-white/5 rounded-xl border border-white/10 text-white/60 hover:text-white transition-colors">
          <ChevronRight className="rotate-180" size={16} />
        </button>
        <h2 className="text-lg font-black text-white uppercase tracking-tight font-display">Imo-ishora tarjimoni</h2>
        <div className="w-8" />
      </div>

      {/* Camera Section - Top */}
      <div className="relative aspect-[4/3] rounded-[20px] overflow-hidden border border-white/10 shadow-2xl group bg-black/40">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
        <canvas ref={canvasRef} className="hidden" />
        
        {/* HUD Elements */}
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <div className="bg-black/40 backdrop-blur-xl text-white px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border border-white/10 flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse shadow-[0_0_8px_var(--color-primary)]" />
            Live AI Vision
          </div>
        </div>

        {/* Targeting Frame */}
        <div className="absolute inset-8 border border-white/10 rounded-2xl pointer-events-none">
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary/40 rounded-tl-lg" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary/40 rounded-tr-lg" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary/40 rounded-bl-lg" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary/40 rounded-br-lg" />
        </div>
        
        {/* Scanning Animation */}
        <div className="absolute inset-x-0 top-0 h-[20%] bg-gradient-to-b from-primary/20 to-transparent opacity-30 animate-[scan_4s_ease-in-out_infinite]" />
      </div>

      {/* Translation Section - Below Camera */}
      <div className="glass-card p-3 flex flex-col justify-center items-center text-center group hover:border-primary/30 transition-all duration-500 relative overflow-hidden">
        {quotaExceeded && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-20 p-4">
            <div className="text-center space-y-3">
              <div className="flex justify-center">
                <div className="p-2 bg-red-500/10 rounded-full">
                  <Settings className="text-red-400 animate-spin-slow" size={20} />
                </div>
              </div>
              <div>
                <p className="text-red-400 text-[10px] font-black uppercase tracking-widest mb-1">Texnik tanaffus (Quota)</p>
                <p className="text-white/40 text-[8px] leading-relaxed">
                  Bepul foydalanish limiti tugadi. <br/> 
                  {cooldown > 0 ? `${cooldown} soniyadan keyin qayta urinib ko'ring.` : '"Tezkor" rejimiga o\'ting yoki kuting.'}
                </p>
              </div>
              <button 
                onClick={() => { setQuotaExceeded(false); captureAndTranslate(); }}
                disabled={cooldown > 0}
                className="w-full text-white bg-primary/20 border border-primary/30 px-4 py-2 rounded-xl text-[9px] font-bold uppercase hover:bg-primary/40 transition-all shadow-xl disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {cooldown > 0 ? `Kuting (${cooldown}s)` : "Qayta urinish"}
              </button>
            </div>
          </div>
        )}
        <div className="w-full space-y-1 mb-3">
          <div className="flex justify-between items-center">
            <p className="text-white/20 text-[7px] uppercase font-black tracking-[0.3em]">Neural Output</p>
            <button 
              onClick={() => setIsPaused(!isPaused)}
              className={cn(
                "text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border transition-all",
                isPaused ? "bg-primary/20 border-primary/30 text-primary" : "bg-white/5 border-white/10 text-white/30"
              )}
            >
              {isPaused ? "To'xtatildi" : "Jonli"}
            </button>
            <button 
              onClick={captureAndTranslate}
              disabled={isCapturing || cooldown > 0}
              className="p-1 px-2 bg-primary/10 border border-primary/20 rounded-full text-[7px] font-black uppercase text-primary hover:bg-primary/20 transition-all disabled:opacity-50"
            >
              {cooldown > 0 ? `${cooldown}s` : "Scan"}
            </button>
          </div>
          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>
        <AnimatePresence mode="wait">
          <motion.p
            key={translation}
            initial={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            className={cn(
              "text-lg font-black leading-tight break-words font-display tracking-tight min-h-[1.5em]",
              quotaExceeded ? "text-red-400" : "text-white"
            )}
          >
            {translation || "Harakat kutilmoqda..."}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="glass-card p-3 flex flex-col justify-center items-center relative overflow-hidden">
          <div className="absolute inset-0 shimmer opacity-50" />
          <p className="text-[7px] text-white/20 uppercase font-black tracking-[0.3em] relative z-10">Confidence</p>
          <div className="relative mt-2 z-10">
            <svg className="w-10 h-10 rotate-[-90deg]">
              <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white/5" />
              <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="113.1" strokeDashoffset={113.1 * (1 - (accuracy === "high" ? 0.99 : accuracy === "balanced" ? 0.94 : 0.85))} className="text-primary transition-all duration-1000" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white">
              {accuracy === "high" ? "99" : accuracy === "balanced" ? "94" : "85"}%
            </span>
          </div>
        </div>
        
        <div className="glass-card p-3 flex flex-col justify-center items-center">
          <p className="text-[7px] text-white/20 uppercase font-black tracking-[0.3em]">Engine</p>
          <p className="text-[10px] font-black text-white mt-1.5">{config.label}</p>
          <p className="text-[7px] text-primary/60 font-black uppercase mt-0.5">{config.perf}</p>
        </div>
      </div>

      {/* Accuracy Adjustment */}
      <div className="glass-card p-4 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {(["fast", "balanced", "high"] as const).map((level) => (
            <button
              key={level}
              onClick={() => setAccuracy(level)}
              className={cn(
                "py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border relative overflow-hidden group",
                accuracy === level 
                  ? "bg-primary border-primary text-white shadow-[0_0_20px_rgba(59,130,246,0.4)]" 
                  : "bg-white/5 border-white/10 text-white/30 hover:bg-white/10 hover:text-white/60"
              )}
            >
              {level === "fast" ? "Speed" : level === "balanced" ? "Auto" : "Pro"}
              {accuracy === level && (
                <motion.div layoutId="active-pill" className="absolute inset-0 bg-white/10" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- Sign Language Visualizer ---

const SignHand = ({ 
  pose = "neutral", 
  side = "right", 
  customStyles = {} 
}: { 
  pose?: string, 
  side?: "left" | "right", 
  customStyles?: any 
}) => {
  const isLeft = side === "left";
  
  // Simplified hand poses using SVG paths
  const poses: Record<string, string> = {
    neutral: "M12 2C10.9 2 10 2.9 10 4V12C10 12.55 10.45 13 11 13H13C13.55 13 14 12.55 14 12V4C14 2.9 13.1 2 12 2Z",
    fist: "M12 6C10.9 6 10 6.9 10 8V12C10 12.55 10.45 13 11 13H13C13.55 13 14 12.55 14 12V8C14 6.9 13.1 6 12 6Z",
    open: "M12 2C10.9 2 10 2.9 10 4V12M7 4C5.9 4 5 4.9 5 6V12M17 4C18.1 4 19 4.9 19 6V12M12 21C14.21 21 16 19.21 16 17H8C8 19.21 9.79 21 12 21Z",
    point: "M12 2C10.9 2 10 2.9 10 4V12M10 12C10 12.55 10.45 13 11 13H13C13.55 13 14 12.55 14 12V10M12 21C14.21 21 16 19.21 16 17H8C8 19.21 9.79 21 12 21Z"
  };

  return (
    <motion.svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn("w-32 h-32 text-primary drop-shadow-[0_0_15px_rgba(96,165,250,0.5)]", isLeft && "-scale-x-100")}
      initial={false}
      style={customStyles}
    >
      <motion.path
        d={poses[pose] || poses.neutral}
        layout
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      />
      {/* Detail lines to make it look more like a hand */}
      <circle cx="12" cy="18" r="4" fill="none" stroke="currentColor" strokeWidth="0.5" className="opacity-20" />
      <path d="M8 12V18M11 12V18M14 12V18M17 12V18" stroke="currentColor" strokeWidth="0.5" className="opacity-30" />
    </motion.svg>
  );
};

const SignVisualizer = ({ text }: { text: string }) => {
  const [currentPose, setCurrentPose] = useState("neutral");
  const [animationName, setAnimationName] = useState<string | null>(null);
  
  const normalizedText = text.toLowerCase().trim();

  useEffect(() => {
    if (!normalizedText) {
      setAnimationName(null);
      setCurrentPose("neutral");
      return;
    }

    const runAnimation = async () => {
      setAnimationName(normalizedText);
      
      if (normalizedText === "salom") {
        // Move hand to forehead then out
        setCurrentPose("open");
        await new Promise(r => setTimeout(r, 2000));
        setCurrentPose("neutral");
      } else if (normalizedText === "rahmat") {
        // Hand moves from chin forward
        setCurrentPose("open");
        await new Promise(r => setTimeout(r, 2000));
        setCurrentPose("fist");
      } else if (normalizedText === "yaxshi") {
        // Thumbs up motion (simplified as open)
        setCurrentPose("point");
        await new Promise(r => setTimeout(r, 2000));
        setCurrentPose("open");
      } else {
        // Generic "spelling" animation for unknown words
        for (let i = 0; i < 3; i++) {
          setCurrentPose("fist");
          await new Promise(r => setTimeout(r, 400));
          setCurrentPose("open");
          await new Promise(r => setTimeout(r, 400));
          setCurrentPose("point");
          await new Promise(r => setTimeout(r, 400));
        }
        setCurrentPose("neutral");
      }
    };

    runAnimation();
  }, [normalizedText]);

  const getMotionVariants = () => {
    if (normalizedText === "salom") {
      return {
        animate: {
          x: [0, 40, 0],
          y: [0, -30, 0],
          rotate: [0, 15, 0],
        },
        transition: { duration: 2, repeat: Infinity }
      };
    }
    if (normalizedText === "rahmat") {
      return {
        animate: {
          z: [0, 50, 0],
          y: [0, 20, 0],
          scale: [1, 1.2, 1],
        },
        transition: { duration: 1.5, repeat: Infinity }
      };
    }
    return {
      animate: { y: [0, -5, 0] },
      transition: { duration: 1, repeat: Infinity }
    };
  };

  const variants = getMotionVariants();

  return (
    <div className="w-full h-full flex items-center justify-center relative overflow-hidden bg-black/40 rounded-[20px]">
      <div className="absolute inset-0 atmospheric-glow opacity-10" />
      
      <motion.div
        animate={variants.animate}
        transition={variants.transition}
        className="relative z-10"
      >
        <SignHand pose={currentPose} />
      </motion.div>

      {/* Grid Overlay for technical look */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />
      
      <div className="absolute top-4 left-4 flex flex-col gap-1">
        <span className="text-[7px] font-black text-primary uppercase tracking-[0.2em]">Visual Synth v1.0</span>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
          <span className="text-[8px] text-white/40 uppercase font-black">{animationName ? `Rendering: ${animationName}` : "Idle"}</span>
        </div>
      </div>
    </div>
  );
};

const TextToSign = ({ onBack }: { onBack: () => void }) => {
  const [text, setText] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [displayText, setDisplayText] = useState("");

  const handleTranslate = () => {
    if (!text.trim()) return;
    setIsTranslating(true);
    // Simulate neural processing time
    setTimeout(() => {
      setDisplayText(text);
      setIsTranslating(false);
    }, 1200);
  };

  return (
    <div className="flex-1 flex flex-col p-4 space-y-4 relative z-10 overflow-y-auto pb-24">
      <div className="flex items-center justify-between mb-1">
        <button onClick={onBack} className="p-2 bg-white/5 rounded-xl border border-white/10 text-white/60 hover:text-white transition-colors">
          <ChevronRight className="rotate-180" size={16} />
        </button>
        <h2 className="text-lg font-black text-white uppercase tracking-tight font-display">Matnni imo-ishoraga</h2>
        <div className="w-8" />
      </div>

      <div className="space-y-1">
        <p className="text-white/30 text-[8px] font-black uppercase tracking-[0.3em]">UZL Neural Vision Synth</p>
      </div>

      {/* Visualizer Section - Top */}
      <div className="aspect-[4/5] glass-card overflow-hidden relative group border-white/5 bg-black/20">
        {isTranslating ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white space-y-4 p-6 z-20 bg-black/60 backdrop-blur-md">
            <div className="relative">
              <div className="w-10 h-10 border-2 border-primary/20 rounded-full" />
              <div className="absolute inset-0 w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-[8px] font-black tracking-[0.3em] uppercase text-center text-white/30 animate-pulse">Analiz qilinmoqda...</p>
          </div>
        ) : (
          <SignVisualizer text={displayText} />
        )}
      </div>

      {/* Input Section - Below Visualizer */}
      <div className="relative group h-28">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Xabarni kiriting (masalan: Salom)..."
          className="w-full h-full p-3 bg-white/[0.02] rounded-[20px] border border-white/5 focus:border-primary/30 focus:bg-white/[0.04] transition-all resize-none text-[11px] font-medium text-white placeholder:text-white/10 backdrop-blur-3xl shadow-inner"
        />
        <button
          onClick={handleTranslate}
          disabled={isTranslating}
          className="absolute bottom-3 right-3 bg-primary text-white p-2.5 rounded-lg shadow-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 glow-primary"
        >
          <Send size={14} />
        </button>
      </div>

      <div className="glass-card p-4 flex items-center justify-between group hover:border-white/20 transition-all">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 group-hover:bg-primary/20 transition-colors">
            <User size={16} className="text-primary" />
          </div>
          <div>
            <p className="text-[8px] text-white/30 font-black uppercase tracking-[0.2em]">Active Accent</p>
            <p className="text-xs font-black text-white font-display">O'zbekcha (UZL)</p>
          </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/20 group-hover:text-white/60 transition-colors">
          <ChevronRight size={16} />
        </div>
      </div>
    </div>
  );
};

const LearnSection = ({ onBack }: { onBack: () => void }) => {
  const lessons = [
    { id: 1, title: "Alifbo", count: "26 ta belgi", color: "bg-primary/10" },
    { id: 2, title: "Salomlashish", count: "12 ta ibora", color: "bg-white/5" },
    { id: 3, title: "Raqamlar", count: "10 ta belgi", color: "bg-primary/10" },
    { id: 4, title: "Oilaviy", count: "15 ta so'z", color: "bg-white/5" },
  ];

  return (
    <div className="flex-1 flex flex-col p-4 space-y-6 overflow-y-auto pb-28 text-white relative z-10">
      <div className="flex items-center justify-between mb-1">
        <button onClick={onBack} className="p-2 bg-white/5 rounded-xl border border-white/10 text-white/60 hover:text-white transition-colors">
          <ChevronRight className="rotate-180" size={16} />
        </button>
        <h2 className="text-lg font-black text-white uppercase tracking-tight font-display">O'rganish bo'limi</h2>
        <div className="w-8" />
      </div>

      <div className="space-y-1">
        <p className="text-white/30 text-[8px] font-black uppercase tracking-[0.3em]">Learning Management System</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {lessons.map((lesson) => (
          <motion.div
            key={lesson.id}
            whileHover={{ y: -4, scale: 1.02 }}
            className={cn("p-4 rounded-[20px] border border-white/5 flex flex-col justify-between aspect-square transition-all duration-500 hover:border-primary/40 hover:bg-white/[0.04] relative overflow-hidden group", lesson.color)}
          >
            <div className="absolute inset-0 shimmer opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-9 h-9 bg-white/5 rounded-xl flex items-center justify-center shadow-inner border border-white/10 relative z-10 group-hover:bg-primary/20 transition-colors">
              <BookOpen size={16} className="text-primary" />
            </div>
            <div className="relative z-10">
              <h3 className="font-black text-base leading-tight text-white font-display tracking-tight">{lesson.title}</h3>
              <div className="mt-1.5 space-y-1">
                <p className="text-[7px] text-white/20 font-black uppercase tracking-widest">{lesson.count}</p>
                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: lesson.id === 1 ? "60%" : lesson.id === 2 ? "30%" : "0%" }}
                    className="h-full bg-primary" 
                  />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="glass-card p-6 text-white space-y-6 relative overflow-hidden group border-white/5">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-[80px] -mr-16 -mt-16 group-hover:bg-primary/30 transition-all duration-1000" />
        <div className="relative z-10 space-y-2">
          <div className="flex items-center space-x-2">
            <div className="px-2 py-0.5 bg-primary/20 rounded-full border border-primary/30 text-[7px] font-black uppercase tracking-widest text-primary">New Challenge</div>
            <div className="h-px flex-1 bg-gradient-to-r from-primary/30 to-transparent" />
          </div>
          <h3 className="text-xl font-black font-display uppercase tracking-tighter leading-none">Daily Training</h3>
          <p className="text-white/40 text-xs leading-relaxed font-medium">Bugun <span className="text-white">"Rahmat"</span> so'zini o'rganamiz. Kamerani yoqing va harakatni takrorlang.</p>
        </div>
        <button className="relative z-10 w-full bg-primary text-white py-4 rounded-2xl font-black uppercase tracking-[0.3em] text-[10px] hover:scale-[1.02] active:scale-[0.98] transition-all glow-primary shadow-2xl">
          Start Training
        </button>
      </div>
    </div>
  );
};

const HomeMenu = ({ onSelect }: { onSelect: (tab: "camera" | "text" | "learn") => void }) => {
  const menuItems = [
    { id: "camera", title: "Kamera", desc: "Imo-ishoralarni matnga tarjima qilish", icon: Camera, color: "bg-primary/10", accent: "text-primary" },
    { id: "text", title: "Matn", desc: "Matnni imo-ishora animatsiyasiga o'tkazish", icon: MessageSquare, color: "bg-white/5", accent: "text-white/60" },
    { id: "learn", title: "O'rganish", desc: "Imo-ishora tilini noldan o'rganing", icon: BookOpen, color: "bg-primary/10", accent: "text-primary" },
  ];

  return (
    <div className="flex-1 flex flex-col p-5 space-y-6 relative z-10 overflow-y-auto">
      {/* Decorative Background Element */}
      <div className="absolute top-16 right-0 w-48 h-48 bg-primary/5 rounded-full blur-[100px] -z-10" />
      
      <div className="space-y-1.5">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2"
        >
          <div className="h-px w-6 bg-primary/40" />
          <p className="text-primary text-[7px] font-black uppercase tracking-[0.3em]">Sado Pro Ecosystem</p>
        </motion.div>
        <h2 className="text-2xl font-black text-white uppercase tracking-tighter font-display leading-[0.9]">
          Kelajak <br/> <span className="text-primary">Muloqoti</span>
        </h2>
      </div>

      <div className="flex flex-col gap-3">
        {menuItems.map((item, index) => (
          <motion.button
            key={item.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.02, x: 4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(item.id as any)}
            className={cn(
              "p-4 rounded-[20px] border border-white/5 flex items-center gap-4 text-left transition-all duration-500 hover:border-primary/40 hover:bg-white/[0.04] relative overflow-hidden group shadow-xl",
              item.color
            )}
          >
            <div className="absolute inset-0 shimmer opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center shadow-inner border border-white/10 relative z-10 group-hover:bg-primary/20 transition-all duration-500 group-hover:rotate-6">
              <item.icon size={18} className={item.accent} />
            </div>
            <div className="relative z-10 flex-1">
              <h3 className="font-black text-base text-white font-display tracking-tight group-hover:text-primary transition-colors">{item.title}</h3>
              <p className="text-[8px] text-white/30 mt-0.5 font-bold uppercase tracking-wider leading-relaxed">{item.desc}</p>
            </div>
            <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-white/10 group-hover:text-primary group-hover:bg-primary/10 transition-all">
              <ChevronRight size={14} />
            </div>
          </motion.button>
        ))}
      </div>

      <div className="glass-card p-5 flex items-center justify-between border-white/5 mt-auto relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex items-center space-x-3 relative z-10">
          <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center border border-green-500/20 shadow-[0_0_20px_rgba(34,197,94,0.1)]">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
          </div>
          <div>
            <p className="text-[7px] text-white/20 font-black uppercase tracking-widest">Neural Network Status</p>
            <p className="text-[10px] font-black text-white/60">Barcha tizimlar tayyor</p>
          </div>
        </div>
        <div className="text-[9px] font-black text-primary/40 uppercase tracking-widest">v2.4.0</div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState<"home" | "camera" | "text" | "learn">("home");

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-0 sm:p-6 font-sans">
      {/* Background Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="atmospheric-glow top-[-10%] left-[-10%] opacity-30" />
        <div className="atmospheric-glow bottom-[-10%] right-[-10%] opacity-20" />
        <div className="atmospheric-glow top-[40%] left-[60%] w-[600px] h-[600px] opacity-10 blur-[120px]" />
      </div>

      <div className="mobile-container shadow-[0_0_150px_rgba(0,0,0,1)] border border-white/5">
        {/* Header */}
        <header className="p-4 pb-2 flex justify-between items-center bg-transparent relative z-20">
          <div className="flex items-center space-x-2.5 cursor-pointer" onClick={() => setActiveTab("home")}>
            <div className="w-8 h-8 bg-primary rounded-[12px] flex items-center justify-center shadow-[0_0_20px_rgba(96,165,250,0.6)] rotate-6 relative group">
              <div className="absolute inset-0 bg-white/20 rounded-[12px] animate-pulse" />
              <div className="w-4 h-4 bg-white rounded-sm rotate-45 relative z-10" />
            </div>
            <div className="flex flex-col -space-y-1">
              <div className="flex items-center gap-1">
                <h1 className="text-lg font-black text-white tracking-tighter uppercase font-display italic">Sado pro</h1>
                <div className="bg-primary/20 border border-primary/30 px-1 py-0.5 rounded-md">
                  <span className="text-[5px] font-black text-primary uppercase tracking-widest">PRO</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[7px] font-black text-primary uppercase tracking-[0.4em] ml-0.5">Vision AI</span>
                <div className="h-px w-4 bg-primary/30" />
              </div>
            </div>
          </div>
          <motion.button 
            whileHover={{ scale: 1.1, rotate: 5 }}
            whileTap={{ scale: 0.9 }}
            className="w-9 h-9 bg-white/[0.05] rounded-[16px] flex items-center justify-center text-white border border-white/10 backdrop-blur-3xl hover:bg-white/10 transition-all shadow-xl"
          >
            <User size={16} />
          </motion.button>
        </header>

        {/* Content */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4, ease: "circOut" }}
              className="flex-1 flex flex-col"
            >
              {activeTab === "home" && <HomeMenu onSelect={setActiveTab} />}
              {activeTab === "camera" && <SignToText onBack={() => setActiveTab("home")} />}
              {activeTab === "text" && <TextToSign onBack={() => setActiveTab("home")} />}
              {activeTab === "learn" && <LearnSection onBack={() => setActiveTab("home")} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
