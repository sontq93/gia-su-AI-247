
import React, { useState, useRef, useEffect } from 'react';
import { Grade, Subject, Message, UserSettings } from './types';
import { getGeminiResponse, generateTTS, generateIllustrativeImage } from './services/geminiService';
import { VoicePlayer } from './components/VoicePlayer';

const App: React.FC = () => {
  const [view, setView] = useState<'landing' | 'chat'>('landing');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject>(Subject.MATH);
  const [settings, setSettings] = useState<UserSettings>({
    grade: Grade.GRADE_1,
    persona: 'normal',
    addressMode: 'con',
    teacherGender: 'Thầy'
  });
  const [activeAudio, setActiveAudio] = useState<string | null>(null);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Icon môn học dạng sách / đen trắng súc tích
  const subjectIcons: Record<Subject, string> = {
    [Subject.MATH]: "📐",
    [Subject.VIETNAMESE]: "📕",
    [Subject.ENGLISH]: "📘",
    [Subject.IT]: "💻",
    [Subject.TECH]: "⚙️",
    [Subject.HISTORY_GEOGRAPHY]: "🗺️",
    [Subject.SCIENCE]: "🧪",
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (view === 'chat') scrollToBottom();
  }, [messages, view, isLoading]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.lang = 'vi-VN';
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => prev + (prev ? ' ' : '') + transcript);
        setIsListening(false);
      };
      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  const toggleListening = () => {
    if (isListening) recognitionRef.current?.stop();
    else {
      setIsListening(true);
      recognitionRef.current?.start();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (view === 'chat' && (messages.length === 0 || (messages.length === 1 && messages[0].id === 'welcome'))) {
      const welcomeText = `Chào ${settings.addressMode}! ${settings.teacherGender} đã sẵn sàng hỗ trợ môn ${selectedSubject} lớp ${settings.grade.replace('Lớp ', '')}. Con muốn cùng giải bài nào?`;
      setMessages([{ id: 'welcome', role: 'model', text: welcomeText }]);
    }
  }, [settings.teacherGender, settings.grade, selectedSubject, view]);

  const handleSelectSubject = (s: Subject) => {
    setSelectedSubject(s);
    if (view === 'landing') {
      setMessages([]); 
      setView('chat');
    } else {
      setMessages([{
        id: 'welcome',
        role: 'model',
        text: `Đã chuyển sang môn ${s} lớp ${settings.grade.replace('Lớp ', '')}. ${settings.teacherGender} có thể giúp gì cho ${settings.addressMode}?`
      }]);
    }
  };

  const handleSend = async () => {
    if (!input.trim() && !selectedImage) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      image: selectedImage || undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setSelectedImage(null);
    setIsLoading(true);

    try {
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const response = await getGeminiResponse(
        input || "Gợi ý bài học qua ảnh này cho con.",
        history,
        settings,
        selectedSubject,
        userMessage.image
      );

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: response.text,
        generatedImages: []
      };

      setMessages(prev => [...prev, botMessage]);

      const imageTags = response.text.match(/\[IMAGE:.*?\]/g) || [];
      if (imageTags.length > 0) {
        const imagePromises = imageTags.map(tag => {
          const prompt = tag.match(/\[IMAGE:(.*?)\]/)?.[1] || "";
          return generateIllustrativeImage(prompt);
        });
        
        const imageUrls = await Promise.all(imagePromises);
        setMessages(prev => prev.map(m => 
          m.id === botMessage.id 
          ? { ...m, generatedImages: imageUrls.filter(url => url !== "") } 
          : m
        ));
      }

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: 'error',
        role: 'model',
        text: "Hệ thống bận một chút, con chờ nhé."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSpeak = async (msgId: string, text: string) => {
    if (playingMessageId === msgId) {
      setActiveAudio(null);
      setPlayingMessageId(null);
      return;
    }

    try {
      setPlayingMessageId(msgId);
      const audio = await generateTTS(text, settings.teacherGender);
      setActiveAudio(audio);
    } catch (error) {
      console.error("TTS failed", error);
      setPlayingMessageId(null);
    }
  };

  const renderMessageContent = (msg: Message) => {
    if (msg.role === 'user') {
      return (
        <div className="flex flex-col gap-2">
          {msg.image && <img src={msg.image} className="max-w-full rounded-2xl shadow-sm border border-white/20" />}
          <div className="whitespace-pre-wrap">{msg.text}</div>
        </div>
      );
    }

    const parts = msg.text.split(/(\[IMAGE:.*?\])/g);
    let imageIdx = 0;

    return (
      <div className="space-y-3">
        {parts.map((part, index) => {
          if (part.startsWith('[IMAGE:')) {
            const currentImg = msg.generatedImages?.[imageIdx];
            imageIdx++;
            if (!currentImg) return null;
            return (
              <div key={index} className="my-1 overflow-hidden rounded-xl shadow-md border border-sky-50">
                <img src={currentImg} className="w-full object-cover" alt="Minh họa" />
              </div>
            );
          }
          return part ? (
            <div key={index} className="whitespace-pre-wrap text-sm md:text-base">
              {part.trim()}
            </div>
          ) : null;
        })}
      </div>
    );
  };

  if (view === 'landing') {
    return (
      <div className="h-screen w-full bg-nature flex flex-col relative overflow-hidden font-quicksand">
        <div className="flex justify-center pt-8 px-4 z-10">
          <div className="glass-panel px-10 py-5 rounded-3xl shadow-2xl border border-white/60 text-center">
            <h1 className="text-3xl font-bold text-sky-800 uppercase tracking-tight">Gia Sư AI 24/7</h1>
            <p className="text-emerald-600 font-bold text-sm">Người Bạn Đồng Hành Tự Học Thông Minh 🌟</p>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-6 z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 max-w-5xl w-full">
            {Object.values(Subject).map((s) => (
              <button 
                key={s} 
                onClick={() => handleSelectSubject(s)} 
                className="subject-card rounded-3xl p-6 flex flex-col items-center justify-center space-y-3 shadow-lg border-b-4 border-sky-200/50"
              >
                <span className="text-5xl bg-white/40 p-4 rounded-2xl shadow-inner">{subjectIcons[s]}</span>
                <span className="text-lg font-bold">{s}</span>
              </button>
            ))}
          </div>
        </div>

        {/* FOOTER TRANG CHỦ: THÔNG TIN LIÊN HỆ */}
        <div className="flex justify-center pb-8 px-4 z-10">
          <div className="glass-panel w-full max-w-4xl p-6 rounded-3xl shadow-2xl flex flex-col items-center space-y-4 border border-white/50">
            <h2 className="text-sky-800 font-bold text-lg flex items-center gap-2">
              <span className="text-2xl">📝</span> Thông tin liên hệ
            </h2>
            <div className="flex flex-col md:flex-row gap-6 md:gap-16 text-gray-700 font-bold text-sm">
              <div className="flex items-center gap-3 bg-white/40 px-4 py-2 rounded-2xl border border-white/30">
                <span className="text-sky-500 text-lg">👤</span>
                <span>Nguyễn Thị Tâm</span>
              </div>
              <div className="flex items-center gap-3 bg-white/40 px-4 py-2 rounded-2xl border border-white/30">
                <span className="text-emerald-500 text-lg">📞</span>
                <span>0937483578</span>
              </div>
              <div className="flex items-center gap-3 bg-white/40 px-4 py-2 rounded-2xl border border-white/30">
                <span className="text-sky-500 text-lg">📧</span>
                <span>nguyentam170117@gmail.com</span>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute inset-0 bg-sky-500/5 pointer-events-none"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-sky-50/30 overflow-hidden font-quicksand">
      <aside className="w-64 bg-emerald-50/50 border-r border-emerald-100 flex flex-col shadow-inner shrink-0 hidden md:flex">
        <div className="p-4 flex items-center gap-4 border-b border-emerald-100 bg-emerald-100/30">
          <button 
            onClick={() => setView('landing')} 
            className="w-10 h-10 bg-sky-500 text-white rounded-xl flex items-center justify-center shadow-md hover:bg-sky-600 transition-all text-xl shrink-0 border-b-2 border-sky-700/20"
          >
            🏠
          </button>
          <span className="font-bold text-sky-800 text-xl truncate">Môn học</span>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-hide">
          {Object.values(Subject).map((s) => (
            <button key={s} onClick={() => handleSelectSubject(s)} className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all font-semibold text-base ${selectedSubject === s ? 'bg-sky-500 text-white shadow-md' : 'text-sky-700 hover:bg-sky-100/50'}`}>
              <span className="text-xl">{subjectIcons[s]}</span>
              <span className="truncate">{s}</span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col relative bg-white min-w-0">
        <header className="bg-white border-b border-sky-100 p-4 flex justify-between items-center z-10 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setView('landing')} className="md:hidden w-8 h-8 bg-sky-500 text-white rounded-lg flex items-center justify-center shadow-sm">🏠</button>
            <div className="w-10 h-10 bg-sky-50 rounded-full flex items-center justify-center text-xl shadow-sm shrink-0 border border-sky-100">{subjectIcons[selectedSubject]}</div>
            <div className="min-w-0">
              <h1 className="font-bold text-sky-900 truncate text-sm md:text-base">Môn {selectedSubject}</h1>
              <p className="text-[10px] md:text-xs text-emerald-600 font-bold truncate tracking-wide uppercase">{settings.grade} • SGK CHUẨN</p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <div className="flex bg-sky-50/50 p-1 rounded-xl border border-sky-100">
              <button onClick={() => setSettings({...settings, teacherGender: 'Thầy'})} className={`px-2 md:px-3 py-1 rounded-lg text-[10px] md:text-xs font-bold transition-all ${settings.teacherGender === 'Thầy' ? 'bg-white text-sky-600 shadow-sm' : 'text-sky-400'}`}>Thầy</button>
              <button onClick={() => setSettings({...settings, teacherGender: 'Cô'})} className={`px-2 md:px-3 py-1 rounded-lg text-[10px] md:text-xs font-bold transition-all ${settings.teacherGender === 'Cô' ? 'bg-white text-sky-600 shadow-sm' : 'text-sky-400'}`}>Cô</button>
            </div>
            <select value={settings.grade} onChange={(e) => setSettings({...settings, grade: e.target.value as Grade})} className="bg-emerald-50 text-emerald-700 rounded-xl px-2 py-1 text-[10px] md:text-xs border-none outline-none font-bold">
              {Object.values(Grade).map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-white to-sky-50/20 scrollbar-hide">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] md:max-w-[70%] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`p-3 md:p-4 shadow-sm transition-all text-sm md:text-base leading-relaxed font-semibold ${msg.role === 'user' ? 'bg-sky-600 text-white rounded-2xl rounded-tr-none' : 'bg-white text-gray-800 rounded-2xl rounded-tl-none border border-sky-100 shadow-sm'}`}>
                  {renderMessageContent(msg)}
                </div>
                {msg.role === 'model' && (
                  <button onClick={() => handleSpeak(msg.id, msg.text)} className={`mt-1.5 text-[10px] font-bold px-3 py-1.5 rounded-full transition-all flex items-center gap-2 shadow-sm ${playingMessageId === msg.id ? 'bg-orange-500 text-white animate-pulse' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-100'}`}>
                    <span>{playingMessageId === msg.id ? '⏹️' : '🔊'}</span>
                    <span>{playingMessageId === msg.id ? 'Dừng giảng' : `Nghe giảng`}</span>
                  </button>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/80 p-3 rounded-xl border border-sky-100 italic text-xs text-sky-600 shadow-sm animate-pulse font-bold">
                {settings.teacherGender} đang soạn bài gợi ý...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </main>

        <footer className="p-3 bg-white border-t border-sky-100 flex flex-col gap-2">
          {selectedImage && (
            <div className="relative shrink-0 w-20 h-20 ml-1">
              <img src={selectedImage} className="w-full h-full object-cover rounded-xl border-2 border-sky-200 shadow-md" alt="Preview" />
              <button 
                onClick={() => setSelectedImage(null)} 
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-lg border-2 border-white"
              >✕</button>
            </div>
          )}
          <div className="flex items-center gap-2 md:gap-3">
            <button onClick={() => fileInputRef.current?.click()} className="p-2.5 bg-sky-50 text-sky-600 rounded-full hover:bg-sky-100 shadow-sm shrink-0 transition-colors border border-sky-100">📷</button>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
            
            <div className="flex-1 relative flex items-center gap-2">
              <div className="relative flex-1">
                <textarea 
                  value={input} 
                  onChange={(e) => setInput(e.target.value)} 
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} 
                  placeholder={`Nhập câu hỏi...`} 
                  className="w-full pl-4 pr-10 py-2.5 bg-sky-50/50 rounded-2xl border border-sky-100 focus:outline-none focus:ring-1 focus:ring-sky-400 resize-none text-sm text-gray-700 transition-all font-semibold" 
                  rows={1} 
                />
                <button 
                  onClick={handleSend} 
                  disabled={isLoading || (!input.trim() && !selectedImage)} 
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:bg-gray-200 transition-all shadow-md"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
              </div>
              <button onClick={toggleListening} className={`p-2.5 rounded-full transition-all shadow-md shrink-0 ${isListening ? 'bg-red-500 text-white animate-bounce shadow-red-200' : 'bg-sky-600 text-white hover:bg-sky-700 shadow-sky-100'}`}>
                {isListening ? '🛑' : '🎤'}
              </button>
            </div>
          </div>
        </footer>

        {activeAudio && <VoicePlayer base64Audio={activeAudio} onEnded={() => { setActiveAudio(null); setPlayingMessageId(null); }} />}
      </div>
    </div>
  );
};

export default App;
