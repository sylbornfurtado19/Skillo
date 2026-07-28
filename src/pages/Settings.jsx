import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  FaUserAlt, 
  FaVolumeUp, 
  FaDatabase, 
  FaSlidersH, 
  FaSave,
  FaCheckCircle,
  FaRobot
} from 'react-icons/fa';
import { useInterview } from '../context/InterviewContext';

export default function Settings() {
  const { user, loginMock, apiKey, setApiKey, theme, setTheme } = useInterview();
  
  // Settings values
  const [profileName, setProfileName] = useState(user?.name || 'Alex Mercer');
  const [profileEmail, setProfileEmail] = useState(user?.email || 'alex.mercer@gmail.com');
  const [targetTitle, setTargetTitle] = useState('Senior Frontend Architect');
  const [voiceRate, setVoiceRate] = useState(1.0);
  const [voicePitch, setVoicePitch] = useState(1.0);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [localApiKey, setLocalApiKey] = useState(apiKey || '');
  
  const [saved, setSaved] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    // Save settings
    loginMock(profileEmail);
    setApiKey(localApiKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-10">
      
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-heading font-extrabold text-white">Settings</h2>
        <p className="text-xs sm:text-sm text-gray-400 mt-1">
          Customize your AI session preferences and local integration tokens.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* 1. Account Profile Settings */}
        <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-white/5">
            <FaUserAlt className="text-primary text-base" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Candidate Profile</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400">Full Name</label>
              <input 
                type="text" 
                value={profileName} 
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full bg-background border border-white/8 focus:border-primary/50 focus:ring-1 focus:ring-primary rounded-xl px-4 py-2.5 text-xs text-white outline-none transition"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400">Email Address</label>
              <input 
                type="email" 
                value={profileEmail} 
                onChange={(e) => setProfileEmail(e.target.value)}
                className="w-full bg-background border border-white/8 focus:border-primary/50 focus:ring-1 focus:ring-primary rounded-xl px-4 py-2.5 text-xs text-white outline-none transition"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-xs font-semibold text-gray-400">Target Role Title</label>
              <input 
                type="text" 
                value={targetTitle} 
                onChange={(e) => setTargetTitle(e.target.value)}
                className="w-full bg-background border border-white/8 focus:border-primary/50 focus:ring-1 focus:ring-primary rounded-xl px-4 py-2.5 text-xs text-white outline-none transition"
              />
            </div>
          </div>
        </div>

        {/* 2. Text-to-Speech Voice Settings */}
        <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-white/5">
            <FaVolumeUp className="text-secondary text-base" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">AI Speech Synthesizer</h3>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-gray-400">Voice Speech Speed:</span>
                  <span className="font-mono text-secondary">{voiceRate}x</span>
                </div>
                <input 
                  type="range" 
                  min="0.5" 
                  max="1.8" 
                  step="0.1" 
                  value={voiceRate} 
                  onChange={(e) => setVoiceRate(parseFloat(e.target.value))}
                  className="w-full h-1 bg-background rounded-lg appearance-none cursor-pointer accent-secondary border border-white/5"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-gray-400">Voice Pitch:</span>
                  <span className="font-mono text-secondary">{voicePitch}</span>
                </div>
                <input 
                  type="range" 
                  min="0.5" 
                  max="1.5" 
                  step="0.1" 
                  value={voicePitch} 
                  onChange={(e) => setVoicePitch(parseFloat(e.target.value))}
                  className="w-full h-1 bg-background rounded-lg appearance-none cursor-pointer accent-secondary border border-white/5"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-white">Enable Subtitle Transcription</p>
                <p className="text-[10px] text-gray-500">Render recruiter dialogue texts during audio streaming.</p>
              </div>
              <button 
                type="button"
                onClick={() => setSubtitlesEnabled(!subtitlesEnabled)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                  subtitlesEnabled ? 'bg-secondary' : 'bg-background border-white/10'
                }`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  subtitlesEnabled ? 'translate-x-4' : 'translate-x-0'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/5">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-white">Interface Theme</p>
                <p className="text-[10px] text-gray-500">Switch between dark mode and light mode.</p>
              </div>
              <button 
                type="button"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                  theme === 'light' ? 'bg-primary' : 'bg-background border-white/10'
                }`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  theme === 'light' ? 'translate-x-4' : 'translate-x-0'
                }`} />
              </button>
            </div>
          </div>
        </div>

        {/* 3. API Integrations Config */}
        <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-white/5">
            <FaDatabase className="text-accent text-base" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">API Integrations Config</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <label className="font-semibold text-gray-400">Developer API Key</label>
                <span className="text-[9px] bg-accent/15 text-accent border border-accent/20 px-1.5 py-0.5 rounded font-mono uppercase">Anthropic key</span>
              </div>
              <input 
                type="password" 
                value={localApiKey} 
                onChange={(e) => setLocalApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className="w-full bg-background border border-white/8 focus:border-accent/50 focus:ring-1 focus:ring-accent rounded-xl px-4 py-2.5 text-xs text-white outline-none transition font-mono"
              />
              <p className="text-[9px] text-gray-500 leading-normal">
                Credentials are saved only in your local session. Leaving this empty defaults to the static assessor model.
              </p>
            </div>
          </div>
        </div>

        {/* Save Actions Bar */}
        <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
          <motion.div
            animate={{ opacity: saved ? 1 : 0, x: saved ? 0 : 10 }}
            className="flex items-center gap-2 text-emerald-400 text-xs font-semibold mr-auto"
          >
            <FaCheckCircle />
            <span>Preferences saved successfully!</span>
          </motion.div>

          <button 
            type="submit"
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-secondary hover:opacity-90 font-semibold text-xs text-white hover:scale-102 active:scale-98 transition duration-250 cursor-pointer shadow-lg shadow-primary/15"
          >
            <FaSave />
            <span>Save Settings</span>
          </button>
        </div>

      </form>

    </div>
  );
}
