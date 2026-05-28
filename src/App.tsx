import React, { useState, useRef, useEffect } from "react";
import { 
  Keyboard, 
  Settings, 
  Terminal, 
  RefreshCw, 
  Plus, 
  Trash, 
  Copy, 
  Volume2, 
  VolumeX, 
  Code, 
  Check, 
  Sliders, 
  Globe, 
  Laptop, 
  HelpCircle, 
  FileText, 
  Sparkles,
  Play,
  Share2
} from "lucide-react";
import { 
  convertText, 
  detectLayoutAnomaly, 
  EN_KEYS, 
  RU_KEYS, 
  UA_KEYS 
} from "./utils/layout";

// Interfaces
interface Snippet {
  id: string;
  trigger: string;
  replacement: string;
  lang: "ru" | "ua" | "en" | "all";
  usageCount: number;
}

export default function App() {
  // Navigation Tabs: 'sandbox' | 'snippets' | 'converter' | 'scripts' | 'help'
  const [activeTab, setActiveTab] = useState<"sandbox" | "snippets" | "converter" | "scripts" | "help">("sandbox");

  // App Settings Toggles
  const [autoSwitch, setAutoSwitch] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [notifyEnabled, setNotifyEnabled] = useState<boolean>(true);
  const [primaryCyrillic, setPrimaryCyrillic] = useState<"ru" | "ua">("ru");

  // State
  const [typedText, setTypedText] = useState<string>("");
  const [notifications, setNotifications] = useState<Array<{ id: string; text: string; time: string }>>([]);
  const [copiedSnippetId, setCopiedSnippetId] = useState<string | null>(null);
  
  // Custom Snippets Store
  const [snippets, setSnippets] = useState<Snippet[]>([
    { id: "1", trigger: ";дд", replacement: "Добрый день!", lang: "ru", usageCount: 14 },
    { id: "2", trigger: ";дп", replacement: "Дякую за допомогу!", lang: "ua", usageCount: 8 },
    { id: "3", trigger: ";сл", replacement: "Слава Україні! Героям слава!", lang: "ua", usageCount: 23 },
    { id: "4", trigger: ";em", replacement: "achebanmx@gmail.com", lang: "all", usageCount: 42 },
    { id: "5", trigger: ";ty", replacement: "Thank you so much!", lang: "en", usageCount: 19 },
    { id: "6", trigger: ";sh", replacement: "¯\\_(ツ)_/¯", lang: "all", usageCount: 5 }
  ]);

  // Snippet Creator Form State
  const [newTrigger, setNewTrigger] = useState("");
  const [newReplacement, setNewReplacement] = useState("");
  const [newLang, setNewLang] = useState<"ru" | "ua" | "en" | "all">("all");

  // Manual Bulk Converter State
  const [manualInput, setManualInput] = useState("");
  const [manualOutput, setManualOutput] = useState("");
  const [manualFrom, setManualFrom] = useState<"en" | "ru" | "ua">("en");
  const [manualTo, setManualTo] = useState<"en" | "ru" | "ua">("ru");

  // Audio Context Ref for physical feedback simulation
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Play mechanical keyboard & swap sound effect
  const playSound = (type: "click" | "switch" | "snippet") => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      if (type === "click") {
        // High pitched short mechanical click
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = "sine";
        osc.frequency.setValueAtTime(1200, ctx.currentTime);
        gain.gain.setValueAtTime(0.012, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.04);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
      } else if (type === "switch") {
        // Soft bubble-like pop layout shift sound (Hammerspoon/Punto feel)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = "triangle";
        osc.frequency.setValueAtTime(350, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.12);
        
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.14);

        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === "snippet") {
        // Two short pleasant chirps
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = "sine";
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.setValueAtTime(800, ctx.currentTime + 0.05);

        gain.gain.setValueAtTime(0.03, ctx.currentTime);
        gain.gain.setValueAtTime(0.03, ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);

        osc.start();
        osc.stop(ctx.currentTime + 0.13);
      }
    } catch (e) {
      console.error("Audio synthesiser issue:", e);
    }
  };

  // Add a nice visual notification
  const addNotification = (text: string) => {
    if (!notifyEnabled) return;
    const id = Date.now().toString();
    const now = new Date();
    const timeStr = now.toTimeString().split(" ")[0];
    
    setNotifications(prev => [
      { id, text, time: timeStr },
      ...prev.slice(0, 4) // cap at 5 notifications
    ]);

    // Play switch sound
    playSound("switch");

    // Auto dispose notification in 4 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  };

  // Real-time Key Monitor
  const handleSandboxChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const diffLen = val.length - typedText.length;
    
    // Play keyboard click sound on additions
    if (diffLen > 0) {
      playSound("click");
    }

    setTypedText(val);

    if (!autoSwitch) return;

    // Split text by white spaces into words
    const words = val.split(/(\s+)/);
    let changed = false;

    // Check each word. We look at words that were just typed and followed by a separator or are final.
    for (let i = 0; i < words.length; i++) {
      const item = words[i];
      // Only handle non-space tokens
      if (item && !/^\s+$/.test(item)) {
        // Check for Custom Snippet replacement first!
        // Dynamic search of user triggers
        const triggerMatch = snippets.find(s => s.trigger === item);
        if (triggerMatch) {
          words[i] = triggerMatch.replacement;
          changed = true;
          triggerMatch.usageCount += 1;
          playSound("snippet");
          break; // break to process changes instantly
        }

        // Layout anomaly detection
        const analysis = detectLayoutAnomaly(item);
        if (analysis.switchNeeded) {
          // If the model suggests 'ru' or 'ua' layout, let's look at the primary cyrillic pref
          let target = analysis.targetLang;
          if (target === "ru" && primaryCyrillic === "ua") {
            // Re-convert to Ukrainian mapping to respect user preference
            target = "ua";
          }
          const fullyConverted = convertText(item, "en", target);
          
          words[i] = fullyConverted;
          changed = true;
          
          const langNames = { en: "English 🇺🇸", ru: "Russian 🇷🇺", ua: "Ukrainian 🇺🇦" };
          addNotification(`Автоматически исправлено на ${langNames[target]}: "${fullyConverted}"`);
          break; // process one change per cycle to be resilient
        }
      }
    }

    if (changed) {
      setTypedText(words.join(""));
    }
  };

  // Quick action to trigger manually for the whole sandbox
  const forceConvertSandbox = (targetLang: "en" | "ru" | "ua") => {
    // Attempt to convert current sandbox text
    // If we assume it's currently English, translate
    const converted = convertText(typedText, "en", targetLang);
    setTypedText(converted);
    addNotification(`Весь текст переведен на ${targetLang.toUpperCase()}`);
  };

  const forceUndoSandbox = () => {
    // Easy way to toggle last conversion or clear the field
    setTypedText("");
    addNotification("Поле ввода очищено");
  };

  // Snippets CRUD
  const handleAddSnippet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTrigger.trim() || !newReplacement.trim()) return;

    // Trigger should start with safe characters (usually PS triggers start with semicolon or dot)
    let validatedTrigger = newTrigger.trim();
    if (!validatedTrigger.startsWith(";") && !validatedTrigger.startsWith(".") && validatedTrigger.length < 3) {
      // Suggest suffix so it doesn't trigger on simple words
      validatedTrigger = ";" + validatedTrigger;
    }

    const newSnip: Snippet = {
      id: Date.now().toString(),
      trigger: validatedTrigger,
      replacement: newReplacement.trim(),
      lang: newLang,
      usageCount: 0
    };

    setSnippets(prev => [newSnip, ...prev]);
    setNewTrigger("");
    setNewReplacement("");
    addNotification(`Сниппет "${validatedTrigger}" зарегистрирован`);
  };

  const handleDeleteSnippet = (id: string, trigger: string) => {
    setSnippets(prev => prev.filter(s => s.id !== id));
    addNotification(`Сниппет "${trigger}" удален`);
  };

  // Bulk Converter Screen actions
  const handleBulkConvert = (from: "en" | "ru" | "ua", to: "en" | "ru" | "ua") => {
    if (!manualInput.trim()) return;
    const res = convertText(manualInput, from, to);
    setManualOutput(res);
    playSound("switch");
  };

  const handleCopyOutput = (text: string) => {
    navigator.clipboard.writeText(text);
    addNotification("Результат успешно скопирован в буфер");
  };

  // Dynamic macOS Script Generators!
  // This takes the current snippet state and generates custom integration configurations!
  const generateHammerspoonScript = (): string => {
    const snippetMapLua = snippets.map(s => {
      // Clean string escaping
      const escapedRep = s.replacement.replace(/"/g, '\\"').replace(/\n/g, '\\n');
      return `  ["${s.trigger}"] = "${escapedRep}"`;
    }).join(",\n");

    return `-- =========================================================================
-- HAMMERSPOON COMPANION SCRIPT (macOS Punto Switcher Analog)
-- Place this code in your ~/.hammerspoon/init.lua file
-- =========================================================================

local EN_KEYS = "${EN_KEYS}"
local RU_KEYS = "${RU_KEYS}"
local UA_KEYS = "${UA_KEYS}"

-- Local cache maps
local enToRu = {}
local ruToEn = {}
local enToUa = {}
local uaToEn = {}

for i = 1, #EN_KEYS do
  local en = EN_KEYS:sub(i, i)
  local ru = RU_KEYS:sub(i, i)
  local ua = UA_KEYS:sub(i, i)
  if en ~= "" then
    if ru ~= "" then enToRu[en] = ru; ruToEn[ru] = en end
    if ua ~= "" then enToUa[en] = ua; uaToEn[ua] = en end
  end
end

-- Your Custom Auto-replace Snippets Map
local SNIPPETS = {
${snippetMapLua}
}

-- Current active buffers
local currentWord = ""

-- Set up keyboard event tapping
local moduleLoader = hs.eventtap.new({ hs.eventtap.event.types.keyDown }, function(event)
  local keyCode = event:getKeyCode()
  local flags = event:getFlags()
  
  -- Skip modifier combinations (Cmd, Alt, Ctrl) to protect default hotkeys
  if flags.cmd or flags.alt or flags.ctrl then 
    return false 
  end
  
  local characters = event:getCharacters()
  if not characters or #characters == 0 then 
    return false 
  end

  -- Detect spaces/returns to evaluate word
  if characters == " " or characters == "\\r" or characters == "\\n" then
    if #currentWord > 0 then
      -- Check snippet replacement
      if SNIPPETS[currentWord] then
        -- Retrospectively remove the trigger word
        for i = 1, #currentWord + 1 do
          hs.eventtap.keyStroke({}, "delete", 0)
        end
        -- Type replacement
        hs.eventtap.keyStrokes(SNIPPETS[currentWord] .. characters)
        currentWord = ""
        return true
      end
    end
    currentWord = ""
    return false
  end

  -- Record character
  if #characters == 1 and characters:match("[%w%;%.%'%[%]%,%/%:\\\"%;%<%>]") then
    currentWord = currentWord .. characters
  else
    currentWord = ""
  end

  return false
end):start()

hs.alert.show("🔌 Layout Switcher Companion initialized!")
`;
  };

  const generatePythonScript = (): string => {
    const pDict = snippets.map(s => {
      return `    '${s.trigger}': '${s.replacement.replace(/'/g, "\\'")}'`;
    }).join(",\n");

    return `# -*- coding: utf-8 -*-
import sys
import os
import time

try:
    from pynput import keyboard
    from pynput.keyboard import Key, Controller
except ImportError:
    print("Error: 'pynput' library is missing. Install with 'pip install pynput'")
    sys.exit(1)

keyboard_controller = Controller()
current_buffer = []

# Your custom registered Snippets from Switcher Suite
SNIPPETS = {
${pDict}
}

# Bidirectional Layout Arrays
EN_KEYS = "${EN_KEYS}"
RU_KEYS = "${RU_KEYS}"
UA_KEYS = "${UA_KEYS}"

# Conversion Mapper lookup
en_to_ru = {en: RU_KEYS[i] for i, en in enumerate(EN_KEYS) if i < len(RU_KEYS)}
en_to_ua = {en: UA_KEYS[i] for i, en in enumerate(EN_KEYS) if i < len(UA_KEYS)}

def check_word_correction():
    global current_buffer
    word = "".join(current_buffer)
    if not word:
        return
    
    # Check for text auto-replace / snippets
    if word in SNIPPETS:
        replacement = SNIPPETS[word]
        # Backspace the typed trigger
        for _ in range(len(word)):
            keyboard_controller.press(Key.backspace)
            keyboard_controller.release(Key.backspace)
            time.sleep(0.01)
        # Retype the replacement
        keyboard_controller.type(replacement)
        current_buffer = []

def on_press(key):
    global current_buffer
    try:
        if hasattr(key, 'char') and key.char is not None:
            char = key.char
            if char.isspace():
                check_word_correction()
                current_buffer = []
            else:
                current_buffer.append(char)
        elif key == Key.space or key == Key.enter:
            check_word_correction()
            current_buffer = []
    except Exception as e:
        print(f"Error handling key press: {e}")

print("🍏 Switcher macOS Python Core active...")
print("Background keyboard monitor running. Press Ctrl+C to terminate.")

with keyboard.Listener(on_press=on_press) as listener:
    listener.join()
`;
  };

  const copyScriptToClipboard = (type: "lua" | "py") => {
    const text = type === "lua" ? generateHammerspoonScript() : generatePythonScript();
    navigator.clipboard.writeText(text);
    setCopiedSnippetId(type);
    addNotification(`Скрипт (${type === "lua" ? "Hammerspoon" : "Python"}) скопирован в буфер!`);
    setTimeout(() => setCopiedSnippetId(null), 2500);
  };

  const downloadScriptFile = (type: "lua" | "py") => {
    const text = type === "lua" ? generateHammerspoonScript() : generatePythonScript();
    const filename = type === "lua" ? "init.lua" : "switcher_companion.py";
    const element = document.createElement("a");
    const file = new Blob([text], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    addNotification(`Файл ${filename} сохранен на диск.`);
  };

  return (
    <div id="root-container" className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans select-none antialiased">
      
      {/* Premium macOS styled Title Bar */}
      <header id="mac-title-bar" className="bg-neutral-900 border-b border-neutral-800 px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-3">
          {/* Traffic light controllers */}
          <div className="flex space-x-1.5">
            <div className="w-3.5 h-3.5 rounded-full bg-red-500 hover:bg-red-600 transition-colors cursor-pointer flex items-center justify-center text-[8px] text-red-950 font-bold">×</div>
            <div className="w-3.5 h-3.5 rounded-full bg-yellow-500 hover:bg-yellow-600 transition-colors cursor-pointer flex items-center justify-center text-[8px] text-yellow-950 font-bold">-</div>
            <div className="w-3.5 h-3.5 rounded-full bg-green-500 hover:bg-green-600 transition-colors cursor-pointer flex items-center justify-center text-[8px] text-green-950 font-bold">+</div>
          </div>
          <div className="h-4 w-px bg-neutral-800"></div>
          <div className="flex items-center space-x-2">
            <Keyboard className="w-4.5 h-4.5 text-blue-400" />
            <span className="font-semibold text-sm tracking-wide text-neutral-200">Switcher</span>
            <span className="text-xs text-neutral-500 bg-neutral-800 px-2 py-0.5 rounded-full border border-neutral-700">v1.4.0 (macOS Companion)</span>
          </div>
        </div>

        {/* Global Mini Settings State / Signals */}
        <div className="flex items-center space-x-4 text-xs text-neutral-400">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block animate-pulse"></span>
            <span className="font-mono text-[11px] text-neutral-300">SYSTEM: ONLINE</span>
          </div>
          <button 
            id="global-audio-toggle"
            onClick={() => setSoundEnabled(!soundEnabled)} 
            className={`p-1.5 rounded-md hover:bg-neutral-800 hover:text-white transition-all ${soundEnabled ? 'text-blue-400' : 'text-neutral-600'}`}
            title={soundEnabled ? "Выключить системные звуки" : "Включить системные звуки"}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Body Grid Layout */}
      <main id="main-content-area" className="flex-1 flex flex-col md:flex-row h-full">
        
        {/* Sidebar Panel */}
        <aside id="app-sidebar" className="w-full md:w-64 bg-neutral-900/60 border-r border-neutral-800 flex flex-col justify-between p-4 space-y-6">
          <div className="space-y-6">
            
            {/* Nav Menu */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold tracking-widest text-neutral-500 uppercase px-2 mb-2">Навигация</p>
              
              <button 
                id="tab-sandbox"
                onClick={() => setActiveTab("sandbox")}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "sandbox" 
                    ? "bg-blue-600 text-white shadow-sm" 
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/80"
                }`}
              >
                <Terminal className="w-4 h-4" />
                <span>Среда Ввода & Свитчер</span>
              </button>

              <button 
                id="tab-snippets"
                onClick={() => setActiveTab("snippets")}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "snippets" 
                    ? "bg-blue-600 text-white shadow-sm" 
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/80"
                }`}
              >
                <FileText className="w-4 h-4" />
                <span className="flex-1 text-left">Автозамена</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-neutral-800 text-neutral-300">{snippets.length}</span>
              </button>

              <button 
                id="tab-converter"
                onClick={() => setActiveTab("converter")}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "converter" 
                    ? "bg-blue-600 text-white shadow-sm" 
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/80"
                }`}
              >
                <RefreshCw className="w-4 h-4" />
                <span>Ручной Конвертер</span>
              </button>

              <button 
                id="tab-scripts"
                onClick={() => setActiveTab("scripts")}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "scripts" 
                    ? "bg-blue-600 text-white shadow-sm" 
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/80"
                }`}
              >
                <Code className="w-4 h-4" />
                <span>Установка в macOS</span>
              </button>

              <button 
                id="tab-help"
                onClick={() => setActiveTab("help")}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "help" 
                    ? "bg-blue-600 text-white shadow-sm" 
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/80"
                }`}
              >
                <HelpCircle className="w-4 h-4" />
                <span>Инструкция</span>
              </button>
            </div>

            {/* Quick Layout Settings */}
            <div className="pt-4 border-t border-neutral-800 space-y-4">
              <p className="text-[10px] font-bold tracking-widest text-neutral-500 uppercase px-2">Быстрый Контроль</p>
              
              <div className="space-y-3 px-2">
                {/* Auto corrections toggle */}
                <label className="flex items-center space-x-3 cursor-pointer text-sm font-medium text-neutral-300">
                  <input 
                    type="checkbox" 
                    checked={autoSwitch}
                    onChange={(e) => setAutoSwitch(e.target.checked)}
                    className="rounded bg-neutral-800 border-neutral-700 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                  <span>Автоисправление</span>
                </label>

                {/* Toast alerts toggle */}
                <label className="flex items-center space-x-3 cursor-pointer text-sm font-medium text-neutral-300">
                  <input 
                    type="checkbox" 
                    checked={notifyEnabled}
                    onChange={(e) => setNotifyEnabled(e.target.checked)}
                    className="rounded bg-neutral-800 border-neutral-700 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                  <span>Всплывающие окна</span>
                </label>

                {/* Primary layout switcher */}
                <div className="space-y-1 pt-1">
                  <span className="text-xs text-neutral-400 block font-light">Кириллица по умолчанию:</span>
                  <div className="flex bg-neutral-800 rounded-lg p-0.5 border border-neutral-700">
                    <button 
                      onClick={() => setPrimaryCyrillic("ru")}
                      className={`flex-1 py-1 text-xs rounded-md transition-all font-semibold ${
                        primaryCyrillic === "ru" 
                          ? "bg-neutral-700 text-white shadow-sm" 
                          : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      Русский (RU)
                    </button>
                    <button 
                      onClick={() => setPrimaryCyrillic("ua")}
                      className={`flex-1 py-1 text-xs rounded-md transition-all font-semibold ${
                        primaryCyrillic === "ua" 
                          ? "bg-neutral-700 text-white shadow-sm" 
                          : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      Украинский (UA)
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Credits footer */}
          <div className="pt-4 border-t border-neutral-800 text-[11px] text-neutral-500 px-2 space-y-1">
            <p>Умная утилита Punto Switcher</p>
            <p className="font-mono text-[9px] text-neutral-600">Designed for US/RU/UA Layouts</p>
          </div>
        </aside>

        {/* Core Screen Container */}
        <section id="app-workspace" className="flex-1 bg-neutral-950 p-6 flex flex-col items-center justify-start overflow-y-auto">
          <div className="max-w-4xl w-full space-y-6">
            
            {/* Dynamic Notification Stack */}
            {notifications.length > 0 && (
              <div id="toast-layer" className="fixed bottom-6 right-6 z-50 space-y-2 pointer-events-none max-w-sm">
                {notifications.map(n => (
                  <div key={n.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 shadow-2xl flex items-start space-x-3 pointer-events-auto animate-in slide-in-from-right duration-200">
                    <span className="text-lg">🤖</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-neutral-100">{n.text}</p>
                      <p className="text-[10px] font-mono text-neutral-500 mt-1">Исправление • {n.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 1: SANDBOX ENVIRONMENT */}
            {activeTab === "sandbox" && (
              <div id="pane-sandbox" className="space-y-6">
                
                {/* Header card description */}
                <div className="bg-gradient-to-r from-blue-900/30 via-neutral-900 to-neutral-900 rounded-xl p-6 border border-neutral-800 flex items-center justify-between">
                  <div className="space-y-2 max-w-lg">
                    <h2 className="text-xl font-bold text-neutral-100 flex items-center space-x-2">
                      <span>Среда Ввода & Свитчер</span>
                      <Sparkles className="w-5 h-5 text-yellow-400" />
                    </h2>
                    <p className="text-sm text-neutral-300 leading-relaxed">
                      Это симуляция автоматического Mac-агента. Начните печатать с ошибками во встроенном редакторе (например, <code className="bg-neutral-800 border border-neutral-700 px-1 rounded font-mono text-blue-300 text-xs">ghbdtn</code>, <code className="bg-neutral-800 border border-neutral-700 px-1 rounded font-mono text-blue-300 text-xs">ntcn</code>, <code className="bg-neutral-800 border border-neutral-700 px-1 rounded font-mono text-blue-300 text-xs">ghbdsn</code> или сниппет <code className="bg-neutral-800 border border-neutral-700 px-1 rounded font-mono text-pink-300 text-xs">;em</code>), и программа мгновенно переведёт слово в соответствующую раскладку.
                    </p>
                  </div>
                  <div className="hidden md:block">
                    <span className="text-5xl">⌨️</span>
                  </div>
                </div>

                {/* Realistic TextEdit Sandbox Frame */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
                  {/* TextEdit window header */}
                  <div className="bg-zinc-900 px-4 py-2.5 border-b border-zinc-800 flex items-center justify-between text-xs text-neutral-400 font-mono">
                    <div className="flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                      <span className="font-semibold text-zinc-300">TextEdit - Simulation Document</span>
                    </div>
                    <div className="flex items-center space-x-3 text-[10px]">
                      <span>Encoding: UTF-8</span>
                      <span>Layout: EN_US/RU_RU/UA_UA</span>
                    </div>
                  </div>

                  {/* Typing canvas */}
                  <div className="p-4 bg-zinc-950">
                    <textarea
                      id="sandbox-textarea"
                      value={typedText}
                      onChange={handleSandboxChange}
                      placeholder="Начните писать здесь... (Попробуйте набрать: 'Привет sнтернет, ntcn cila ;em')"
                      className="w-full h-64 bg-transparent resize-none border-0 p-2 focus:ring-0 focus:outline-none font-mono text-base leading-relaxed text-zinc-100 placeholder-zinc-600"
                    ></textarea>
                  </div>

                  {/* Editor footer metrics */}
                  <div className="bg-zinc-900 px-4 py-3 border-t border-zinc-800 flex flex-wrap items-center justify-between text-xs font-mono text-neutral-400 gap-3">
                    <div className="flex space-x-4">
                      <span>Символов: <strong>{typedText.length}</strong></span>
                      <span>Слов: <strong>{typedText.trim() ? typedText.trim().split(/\s+/).length : 0}</strong></span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button 
                        id="btn-sandbox-ru"
                        onClick={() => forceConvertSandbox("ru")}
                        className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-3 py-1 rounded-md transition-colors"
                      >
                        ➜ РУ (ЙЦУКЕН)
                      </button>
                      <button 
                        id="btn-sandbox-ua"
                        onClick={() => forceConvertSandbox("ua")}
                        className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-3 py-1 rounded-md transition-colors"
                      >
                        ➜ УА (ЙЦУКЕН)
                      </button>
                      <button 
                        id="btn-sandbox-en"
                        onClick={() => forceConvertSandbox("en")}
                        className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-3 py-1 rounded-md transition-colors"
                      >
                        ➜ EN (QWERTY)
                      </button>
                      <button 
                        id="btn-clear-sandbox"
                        onClick={forceUndoSandbox}
                        className="bg-red-950 hover:bg-red-900 text-red-300 px-3 py-1 rounded-md transition-colors"
                      >
                        Очистить
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sub-panels: Keyboard layouts reference map */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* EN Column */}
                  <div className="bg-neutral-900/40 p-4 rounded-xl border border-neutral-800 space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-base">🇺🇸</span>
                      <h3 className="text-xs font-bold tracking-wider text-neutral-300 font-mono">QWERTY - English</h3>
                    </div>
                    <p className="text-[11px] text-neutral-400 font-mono leading-tight">
                      a b c d e f g h i j k l m...<br />
                      Keys: Standard US mapping
                    </p>
                    <div className="bg-black/40 p-2 rounded text-[10px] font-mono text-blue-400">
                      e.g. `gthtndjl`
                    </div>
                  </div>

                  {/* RU Column */}
                  <div className="bg-neutral-900/40 p-4 rounded-xl border border-neutral-800 space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-base">🇷🇺</span>
                      <h3 className="text-xs font-bold tracking-wider text-neutral-300 font-mono">RU ЙЦУКЕН - Russian</h3>
                    </div>
                    <p className="text-[11px] text-neutral-400 font-mono leading-tight">
                      ф ы в а п р о л д ж э я ч...<br />
                      Keys: (s) = ы || (]) = ъ || (') = э
                    </p>
                    <div className="bg-black/40 p-2 rounded text-[10px] font-mono text-green-400">
                      ➜ `перевод`
                    </div>
                  </div>

                  {/* UA Column */}
                  <div className="bg-neutral-900/40 p-4 rounded-xl border border-neutral-800 space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-base">🇺🇦</span>
                      <h3 className="text-xs font-bold tracking-wider text-neutral-300 font-mono">UA ЙЦУКЕН - Ukrainian</h3>
                    </div>
                    <p className="text-[11px] text-neutral-400 font-mono leading-tight">
                      ф і в а п р о л д ж є я ч...<br />
                      Keys: (s) = і || (]) = ї || (') = є
                    </p>
                    <div className="bg-black/40 p-2 rounded text-[10px] font-mono text-yellow-400">
                      ➜ `переклад`
                    </div>
                  </div>

                </div>

              </div>
            )}

            {/* TAB 2: SHORTCUTS & SNIPPETS MANAGER */}
            {activeTab === "snippets" && (
              <div id="pane-snippets" className="space-y-6">
                
                {/* Intro summary card */}
                <div className="bg-gradient-to-r from-teal-900/30 via-neutral-900 to-neutral-900 rounded-xl p-6 border border-neutral-800 flex items-center justify-between">
                  <div className="space-y-2 max-w-xl">
                    <h2 className="text-xl font-bold text-neutral-100 flex items-center space-x-2">
                      <span>Настройка Автозамены & Сниппетов</span>
                    </h2>
                    <p className="text-sm text-neutral-300 leading-relaxed">
                      Автозамена (Snippets) преобразует сокращенные триггеры в заготовленные полноценные фразы сразу после ввода клавиши <strong>Пробел</strong> или <strong>Enter</strong>. Они ускоряют заполнение повторяющейся корреспонденции, адресов электронной почты и формул.
                    </p>
                  </div>
                  <div className="hidden md:block">
                    <span className="text-5xl">📝</span>
                  </div>
                </div>

                {/* Grid layout for sniper configuration table & builder form */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Create Snippet Form Container */}
                  <div className="bg-neutral-900/60 p-5 rounded-2xl border border-neutral-800 space-y-4">
                    <h3 className="text-sm font-bold tracking-wider uppercase text-neutral-300 flex items-center space-x-2">
                      <Sliders className="w-4 h-4 text-blue-400" />
                      <span>Новый Сниппет</span>
                    </h3>
                    
                    <form onSubmit={handleAddSnippet} className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-xs text-neutral-400 block font-medium">Клавиша-триггер (Trigger):</label>
                        <input 
                          id="input-trigger"
                          type="text" 
                          value={newTrigger}
                          onChange={(e) => setNewTrigger(e.target.value)}
                          placeholder="например: ;дд"
                          className="w-full bg-neutral-950 border border-neutral-800 focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-neutral-100 font-mono placeholder-neutral-600 focus:outline-none"
                        />
                        <span className="text-[10px] text-neutral-500">Рекомендуется начинать с <code className="font-mono text-neutral-400">;</code> или <code className="font-mono text-neutral-400">.</code> для изоляции</span>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-neutral-400 block font-medium">Замещающий текст (Replacement):</label>
                        <textarea 
                          id="input-replacement"
                          value={newReplacement}
                          onChange={(e) => setNewReplacement(e.target.value)}
                          placeholder="Добрый день! Как дела?"
                          rows={3}
                          className="w-full bg-neutral-950 border border-neutral-800 focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none"
                        ></textarea>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-neutral-400 block font-medium">Раскладка назначения:</label>
                        <select 
                          id="select-snippet-lang"
                          value={newLang}
                          onChange={(e: any) => setNewLang(e.target.value)}
                          className="w-full bg-neutral-950 border border-neutral-800 focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none cursor-pointer"
                        >
                          <option value="all">Любая языковая среда (Универсально)</option>
                          <option value="ru">Только русский (RU)</option>
                          <option value="ua">Только украинский (UA)</option>
                          <option value="en">Только английский (EN)</option>
                        </select>
                      </div>

                      <button 
                        id="btn-add-snippet"
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-xs font-semibold tracking-wide transition-all shadow-md flex items-center justify-center space-x-1"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Добавить Сниппет</span>
                      </button>
                    </form>
                  </div>

                  {/* Snippets Store list */}
                  <div className="lg:col-span-2 bg-neutral-900/20 rounded-2xl border border-neutral-800 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-neutral-300 tracking-wider uppercase flex items-center space-x-2">
                        <Keyboard className="w-4 h-4 text-emerald-400" />
                        <span>Активные Сниппеты в Системе</span>
                      </h3>
                      <span className="text-xs text-neutral-500 font-mono">Всего: {snippets.length}</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table id="tbl-snippets-list" className="w-full text-left text-xs text-neutral-300 font-mono">
                        <thead>
                          <tr className="border-b border-neutral-800 text-neutral-500 font-bold">
                            <th className="pb-3 pt-1">Триггер</th>
                            <th className="pb-3 pt-1">Автозамена</th>
                            <th className="pb-3 pt-1">Язык</th>
                            <th className="pb-3 pt-1 text-center">Охват</th>
                            <th className="pb-3 pt-1 text-right">Статус</th>
                          </tr>
                        </thead>
                        <tbody>
                          {snippets.map(s => (
                            <tr key={s.id} className="border-b border-neutral-800/60 hover:bg-neutral-900/30 transition-colors">
                              <td className="py-3 text-yellow-400 font-bold">{s.trigger}</td>
                              <td className="py-3 max-w-[180px] truncate text-neutral-100" title={s.replacement}>
                                {s.replacement}
                              </td>
                              <td className="py-3">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] border ${
                                  s.lang === "ru" ? "bg-red-950/40 text-red-300 border-red-900/60" :
                                  s.lang === "ua" ? "bg-yellow-950/40 text-yellow-300 border-yellow-800/60" :
                                  s.lang === "en" ? "bg-blue-950/40 text-blue-300 border-blue-900/60" :
                                  "bg-neutral-800 text-neutral-300 border-neutral-700"
                                }`}>
                                  {s.lang.toUpperCase()}
                                </span>
                              </td>
                              <td className="py-3 text-center text-neutral-400">
                                {s.usageCount} исп.
                              </td>
                              <td className="py-3 text-right">
                                <button
                                  onClick={() => handleDeleteSnippet(s.id, s.trigger)}
                                  className="text-neutral-500 hover:text-red-400 p-1 rounded hover:bg-neutral-800/80 transition-colors"
                                  title="Удалить правило"
                                >
                                  <Trash className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>

              </div>
            )}

            {/* TAB 3: BULK CONVERTER TOOL */}
            {activeTab === "converter" && (
              <div id="pane-converter" className="space-y-6">
                
                {/* Intro details card */}
                <div className="bg-gradient-to-r from-teal-950/30 via-neutral-900 to-neutral-900 rounded-xl p-6 border border-neutral-800 flex items-center justify-between">
                  <div className="space-y-2 max-w-xl">
                    <h2 className="text-xl font-bold text-neutral-100 flex items-center space-x-2">
                      <span>Ручной Дешифратор Раскладок</span>
                    </h2>
                    <p className="text-sm text-neutral-300 leading-relaxed">
                      Если вы скопировали текст, напечатанный вслепую не в той раскладке, вставьте его в поле ниже, выберите направление и мгновенно расшифруйте! Наша таблица конвертирует все символы, включая знаки препинания и заглавные буквы.
                    </p>
                  </div>
                  <div className="hidden md:block">
                    <span className="text-5xl">🔄</span>
                  </div>
                </div>

                {/* Main converter grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Left column: Input box and configure translation */}
                  <div className="space-y-4">
                    <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-neutral-300 uppercase font-mono font-semibold tracking-wider">Исходный кривой текст:</label>
                        <button 
                          onClick={() => setManualInput("")}
                          className="text-[10px] text-neutral-500 hover:text-neutral-300 font-mono underline"
                        >
                          Очистить
                        </button>
                      </div>
                      <textarea
                        id="bulk-text-input"
                        value={manualInput}
                        onChange={(e) => setManualInput(e.target.value)}
                        placeholder="Например: Ghbdtn, rfr ltkf? (для перевода в 'Привет, как дела?')"
                        rows={6}
                        className="w-full bg-neutral-950 border border-neutral-800 focus:border-blue-500 rounded-lg p-3 text-sm text-neutral-100 font-mono placeholder-neutral-700 focus:outline-none"
                      ></textarea>
                    </div>

                    {/* Directions selector */}
                    <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 space-y-3">
                      <label className="text-xs text-neutral-400 font-mono block">Трансформировать:</label>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <span className="text-[10px] text-neutral-500 block">Откуда (Из):</span>
                          <select 
                            id="select-convert-from"
                            value={manualFrom}
                            onChange={(e: any) => setManualFrom(e.target.value)}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-xs font-mono text-neutral-300"
                          >
                            <option value="en">English (QWERTY)</option>
                            <option value="ru">Русский (ЙЦУКЕН)</option>
                            <option value="ua">Украинский (ЙЦУКЕН)</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] text-neutral-500 block">Куда (В):</span>
                          <select 
                            id="select-convert-to"
                            value={manualTo}
                            onChange={(e: any) => setManualTo(e.target.value)}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-xs font-mono text-neutral-300"
                          >
                            <option value="ru">Русский (ЙЦУКЕН)</option>
                            <option value="ua">Украинский (ЙЦУКЕН)</option>
                            <option value="en">English (QWERTY)</option>
                          </select>
                        </div>
                      </div>

                      <button 
                        id="btn-perform-convert"
                        onClick={() => handleBulkConvert(manualFrom, manualTo)}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs tracking-wider py-2.5 rounded-lg transition-all flex items-center justify-center space-x-2 shadow"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>ВЫПОЛНИТЬ КОНВЕРТАЦИЮ</span>
                      </button>
                    </div>
                  </div>

                  {/* Right column: Output results preview */}
                  <div className="bg-neutral-900 p-5 rounded-xl border border-neutral-800 flex flex-col justify-between space-y-4">
                    <div className="space-y-3 flex-1 flex flex-col justify-start">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-emerald-400 font-mono tracking-wider font-semibold uppercase">Расшифрованный текст:</label>
                        {manualOutput && (
                          <button 
                            id="btn-copy-bulk-output"
                            onClick={() => handleCopyOutput(manualOutput)}
                            className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-3 py-1 rounded-md text-[10px] font-mono flex items-center space-x-1"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>Копировать</span>
                          </button>
                        )}
                      </div>
                      
                      <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 flex-1 font-mono text-sm min-h-[160px] whitespace-pre-wrap text-emerald-300">
                        {manualOutput || <span className="text-neutral-700 italic">Ожидание конвертации...</span>}
                      </div>
                    </div>

                    <div className="text-[11px] text-neutral-500 rounded-lg bg-black/30 p-3 leading-relaxed">
                      💡 <strong>Пример:</strong> Скопируйте хаотичную строку на подобии <code className="text-zinc-300 font-mono font-bold bg-neutral-800 px-1 rounded">Vscnth, nscy hscy</code>, настройте трансляцию <code className="text-zinc-300">en ➔ ua</code> и получите <code className="text-green-400 font-bold">"Містер, тисяч тисяч"</code>!
                    </div>
                  </div>

                </div>

              </div>
            )}

            {/* TAB 4: MACOS NATIVE SCRIPTS / SYSTEM INSTALL */}
            {activeTab === "scripts" && (
              <div id="pane-scripts" className="space-y-6">
                
                {/* Intro summary banner */}
                <div className="bg-gradient-to-r from-emerald-950/30 via-neutral-900 to-neutral-900 rounded-xl p-6 border border-neutral-800 flex items-center justify-between">
                  <div className="space-y-2 max-w-xl">
                    <h2 className="text-xl font-bold text-neutral-100 flex items-center space-x-2">
                      <Laptop className="w-5 h-5 text-emerald-400" />
                      <span>Локальная Установка в macOS Sonoma/Sequoia</span>
                    </h2>
                    <p className="text-sm text-neutral-300 leading-relaxed">
                      Браузерная среда изолирована и не может прослушивать ваши клавиши вне этой страницы. Чтобы получить полноценный <strong>Punto Switcher нативно на вашем Mac</strong>, скачайте или соберите один из двух разработанных нами расширяемых скриптов! Они настроены под ваши автозамены!
                    </p>
                  </div>
                  <div className="hidden md:block">
                    <span className="text-5xl">🍏</span>
                  </div>
                </div>

                {/* Twin options panel */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Option 1: Hammerspoon Lua Core */}
                  <div className="bg-neutral-900/80 rounded-2xl border border-neutral-800 overflow-hidden flex flex-col justify-between">
                    <div className="p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="bg-blue-950/50 text-blue-300 border border-blue-900 text-xs px-2.5 py-0.5 rounded-full font-mono font-bold">ВАРИАНТ A • РЕКОМЕНДУЕМЫЙ</span>
                        <span className="text-xs text-neutral-500 font-mono">Lua Script</span>
                      </div>
                      <h3 className="text-lg font-bold text-neutral-100 font-sans">Скрипт Hammerspoon (init.lua)</h3>
                      <p className="text-xs text-neutral-400 leading-relaxed">
                        Hammerspoon — это беспланый мощный OS-менеджер с открытым исходным кодом для macOS. Наш скрипт нативно перехватывает ввод, делает автоисправления и разворачивает ваши {snippets.length} сниппетов во всех системных полях ввода на Mac.
                      </p>
                      
                      {/* Code preview block */}
                      <pre className="bg-neutral-950/90 border border-neutral-800 rounded-lg p-3 text-[10px] font-mono text-blue-400 h-40 overflow-y-auto overflow-x-hidden leading-snug">
                        {generateHammerspoonScript()}
                      </pre>
                    </div>

                    <div className="bg-neutral-950 px-5 py-4 border-t border-neutral-800 flex space-x-2">
                      <button 
                        onClick={() => copyScriptToClipboard("lua")}
                        className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold py-2 rounded-lg transition-all flex items-center justify-center space-x-1"
                      >
                        {copiedSnippetId === "lua" ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                        <span>Копировать код</span>
                      </button>
                      <button 
                        onClick={() => downloadScriptFile("lua")}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2 rounded-lg transition-all flex items-center justify-center space-x-1"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Скачать файл</span>
                      </button>
                    </div>
                  </div>

                  {/* Option 2: CLI Python Daemon */}
                  <div className="bg-neutral-900/80 rounded-2xl border border-neutral-800 overflow-hidden flex flex-col justify-between">
                    <div className="p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="bg-green-950/50 text-green-300 border border-green-900 text-xs px-2.5 py-0.5 rounded-full font-mono font-bold">ВАРИАНТ Б • ТЕХНИЧЕСКИЙ</span>
                        <span className="text-xs text-neutral-500 font-mono">Python App</span>
                      </div>
                      <h3 className="text-lg font-bold text-neutral-100 font-sans">Фоновый Демон Python (pynput)</h3>
                      <p className="text-xs text-neutral-400 leading-relaxed">
                        Легковесный фоновый скрипт на Python 3. Работает напрямую в терминале через системные хуки эмуляции событий клавиатуры, отслеживая ввод триггеров автозамены. Идеально для разработчиков.
                      </p>
                      
                      {/* Code preview block */}
                      <pre className="bg-neutral-950/90 border border-neutral-800 rounded-lg p-3 text-[10px] font-mono text-emerald-400 h-40 overflow-y-auto overflow-x-hidden leading-snug">
                        {generatePythonScript()}
                      </pre>
                    </div>

                    <div className="bg-neutral-950 px-5 py-4 border-t border-neutral-800 flex space-x-2">
                      <button 
                        onClick={() => copyScriptToClipboard("py")}
                        className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold py-2 rounded-lg transition-all flex items-center justify-center space-x-1"
                      >
                        {copiedSnippetId === "py" ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                        <span>Копировать код</span>
                      </button>
                      <button 
                        onClick={() => downloadScriptFile("py")}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2 rounded-lg transition-all flex items-center justify-center space-x-1"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Скачать файл</span>
                      </button>
                    </div>
                  </div>

                </div>

                {/* Unified Terminal installation command guide box */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3 font-mono text-xs">
                  <div className="flex items-center space-x-2 text-zinc-300 font-bold border-b border-zinc-800 pb-2 mb-2">
                    <Terminal className="w-4.5 h-4.5 text-yellow-500" />
                    <span>ИНСТРУКЦИЯ ПО ШАГАМ ДЛЯ HAMMERSPOON (ВАРИАНТ A):</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-2 text-zinc-400">
                    <li>Установите менеджер макросов через терминал: <code className="bg-black text-yellow-400 px-2 py-0.5 rounded border border-neutral-800">brew install --cask hammerspoon</code> (или скачайте с официального сайта).</li>
                    <li>Кликните "Скачать файл" для Варианта А или создайте файл <code className="text-white">~/.hammerspoon/init.lua</code>.</li>
                    <li>Поместите сгенерированный код в этот файл.</li>
                    <li>Запустите приложение Hammerspoon на Mac и разрешите ему контроль в <span className="text-zinc-200">Системные Настройки &gt; Конфиденциальность &gt; Универсальный Доступ</span>.</li>
                    <li>Нажмите "Reload Config" в статус-баре Hammerspoon. Переключатель готов к работе!</li>
                  </ol>
                </div>

              </div>
            )}

            {/* TAB 5: COMPREHENSIVE HELP / DOCUMENTATION */}
            {activeTab === "help" && (
              <div id="pane-help" className="space-y-6">
                
                <div className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800 space-y-4">
                  <h2 className="text-xl font-bold text-neutral-100 flex items-center space-x-2">
                    <HelpCircle className="w-5 h-5 text-blue-400" />
                    <span>Принцип Работы Switcher на macOS</span>
                  </h2>
                  <div className="text-sm text-neutral-300 space-y-4 leading-relaxed">
                    <p>
                      Поскольку классическое приложение <strong>Punto Switcher</strong> для macOS от Яндекса более не поддерживается на современных версиях операционной системы (Sonoma, Sequoia и др.), пользователи часто сталкиваются с проблемой ошибочного набора и необходимостью вручную перепечатывать текст.
                    </p>
                    <p>
                      Данное веб-приложение создано как интерактивный полигон для моделирования и тестирования алгоритмов автоматического исправления ошибок клавиатуры в реальном времени, а также как конфигурационная студия.
                    </p>
                    
                    <h3 className="text-base font-bold text-neutral-200 mt-6">Особенности нашего алгоритма:</h3>
                    <ul className="list-disc list-inside space-y-2 pl-2">
                      <li><strong className="text-blue-400">Триггерная фильтрация:</strong> Мониторинг запрещенных звуковых и буквенных переходов в разных языках (например, отсутствие в английском языке сочетаний согласных типа 'ntcn' в начале слов).</li>
                      <li><strong className="text-green-400">Мультиязыковая дифференциация:</strong> Система определяет разницу между Русской и Украинской раскладкой, проверяя наличие специфичных символов или сравнивая слова со встроенным частотным словарём (например, <code className="text-zinc-300 bg-neutral-850 px-1 rounded">sнтернет</code> преобразуется в <code className="text-green-400">інтернет</code>).</li>
                      <li><strong className="text-yellow-400">Пользовательские расширения:</strong> Сниппеты заменяются мгновенно при нажатии на пробел или ввод (e.g. ";SL" превратится в "Слава Україні!").</li>
                    </ul>

                    <div className="bg-blue-950/20 rounded-xl p-4 border border-blue-900/40 text-xs text-blue-300 mt-4 leading-relaxed">
                      ⚠️ <strong>Безопасность:</strong> Все алгоритмы и конфигураторы в этом приложении выполняются полностью локально в вашем браузере. Данные с ваших клавиатур никогда не передаются на внешние сервера, сохраняя максимальную защищенность личной переписки.
                    </div>
                  </div>
                </div>

              </div>
            )}

          </div>
        </section>

      </main>

      {/* Persistent global notification bar/footer status */}
      <footer id="global-status-footer" className="bg-neutral-900 border-t border-neutral-800 px-4 py-2.5 text-xs text-neutral-500 font-mono flex flex-col sm:flex-row items-center justify-between gap-2 shadow-inner">
        <div className="flex items-center space-x-2">
          <Globe className="w-3.5 h-3.5 text-blue-400" />
          <span>Среда эмуляции layouts: <strong>US-QWERTY ⇄ RU-ЙЦУКЕН ⇄ UA-ЙЦУКЕН</strong></span>
        </div>
        <div>
          <span>Пользователь: <span className="text-neutral-300">achebanmx@gmail.com</span></span>
        </div>
      </footer>

    </div>
  );
}
