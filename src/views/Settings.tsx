'use client';

import React, { useState, useEffect, useId } from 'react';
import { motion } from 'framer-motion';
import { FaUserAlt, FaVolumeUp, FaSave, FaCheckCircle } from 'react-icons/fa';

import { useAuth } from '../hooks/useAuth';
import { getProfile, updateProfile } from '../services/profile';
import { useToast } from '../components/ui/Toast';
import { ThemeSwitcher } from '../components/common/ThemeSwitcher';
import { Input, Textarea } from '../components/ui/InputFields';

export default function Settings() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [saving, setSaving] = useState(false);

  const nameInputId = useId();
  const emailInputId = useId();
  const titleInputId = useId();
  const voiceRateId = useId();
  const voicePitchId = useId();

  const candidateName =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    user?.email?.split('@')[0] ??
    'Candidate';
  const candidateEmail = user?.email ?? '';

  const [profileName, setProfileName] = useState(candidateName);
  const [profileEmail, setProfileEmail] = useState(candidateEmail);
  const [targetTitle, setTargetTitle] = useState('');
  const [practiceNotes, setPracticeNotes] = useState('');
  const [voiceRate, setVoiceRate] = useState(1.0);
  const [voicePitch, setVoicePitch] = useState(1.0);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [isSpeakingTest, setIsSpeakingTest] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSpeechSupported('speechSynthesis' in window);
    }
  }, []);

  const handleTestVoice = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      'Hello! I am your AI interviewer. This is a preview of my voice pitch and speech rate.'
    );
    utterance.rate = voiceRate;
    utterance.pitch = voicePitch;
    utterance.onstart = () => setIsSpeakingTest(true);
    utterance.onend = () => setIsSpeakingTest(false);
    utterance.onerror = () => setIsSpeakingTest(false);
    window.speechSynthesis.speak(utterance);
  };

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    getProfile(user.id).then(({ data }) => {
      if (data) {
        if (data.name) setProfileName(data.name);
        if (data.email) setProfileEmail(data.email);
        if (data.title) setTargetTitle(data.title);

        if (data.profileSettings) {
          const ps = data.profileSettings;
          if (typeof ps.voiceRate === 'number') setVoiceRate(ps.voiceRate);
          if (typeof ps.voicePitch === 'number') setVoicePitch(ps.voicePitch);
          if (typeof ps.subtitlesEnabled === 'boolean') setSubtitlesEnabled(ps.subtitlesEnabled);
          if (typeof ps.practiceNotes === 'string') setPracticeNotes(ps.practiceNotes);
        }

      }
    });
  }, [user?.id]);



  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) {
      showToast('You must be logged in to save settings', 'error');
      return;
    }

    setSaving(true);
    try {
      const updates = {
        name: profileName,
        email: profileEmail,
        title: targetTitle,
        profileSettings: {
          voiceRate,
          voicePitch,
          subtitlesEnabled,
          practiceNotes,
        },
      };

      const { error } = await updateProfile(user.id, updates);

      if (error) {
        const errObj = error as { message?: string };
        showToast(`Save Error: ${errObj.message ?? 'Failed to update preferences'}`, 'error');
      } else {
        setSaved(true);
        showToast('Settings & Profile saved successfully!', 'success');
        setTimeout(() => setSaved(false), 3500);
      }
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      showToast(`Error: ${errObj.message ?? 'An unknown error occurred'}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-10 text-left">
      <div>
        <h2 className="text-xl sm:text-2xl font-heading font-extrabold text-text-primary">Settings</h2>
        <p className="text-xs sm:text-sm text-text-secondary mt-1">
          Customize your AI session preferences and application defaults.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-bg-surface rounded-2xl p-6 border border-border shadow-soft space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-border">
            <FaUserAlt aria-hidden="true" className="text-primary text-base" />
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Candidate Profile</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id={nameInputId}
              label="Full Name"
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="e.g. Alex Mercer"
            />
            <Input
              id={emailInputId}
              label="Email Address"
              type="email"
              value={profileEmail}
              onChange={(e) => setProfileEmail(e.target.value)}
              placeholder="name@company.com"
            />
            <div className="sm:col-span-2">
              <Input
                id={titleInputId}
                label="Target Role Title"
                type="text"
                value={targetTitle}
                onChange={(e) => setTargetTitle(e.target.value)}
                placeholder="e.g. Senior Frontend Architect / Staff Engineer"
              />
            </div>
            <div className="sm:col-span-2">
              <Textarea
                label="Preparation Goals & Notes"
                placeholder="Enter personal preparation targets, interview weaknesses to focus on, or target technologies..."
                value={practiceNotes}
                onChange={(e) => setPracticeNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        </div>

        <div className="bg-bg-surface rounded-2xl p-6 border border-border shadow-soft space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-border">
            <FaVolumeUp aria-hidden="true" className="text-secondary text-base" />
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">AI Speech Synthesizer</h3>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <label htmlFor={voiceRateId} className="font-semibold text-text-secondary">Voice Speech Speed:</label>
                  <span className="font-mono text-secondary">{voiceRate}x</span>
                </div>
                <input
                  id={voiceRateId}
                  type="range"
                  min="0.5"
                  max="1.8"
                  step="0.1"
                  value={voiceRate}
                  onChange={(e) => setVoiceRate(parseFloat(e.target.value))}
                  className="w-full h-1 bg-bg-surface-alt rounded-lg appearance-none cursor-pointer accent-primary border border-border"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <label htmlFor={voicePitchId} className="font-semibold text-text-secondary">Voice Pitch:</label>
                  <span className="font-mono text-secondary">{voicePitch}</span>
                </div>
                <input
                  id={voicePitchId}
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.1"
                  value={voicePitch}
                  onChange={(e) => setVoicePitch(parseFloat(e.target.value))}
                  className="w-full h-1 bg-bg-surface-alt rounded-lg appearance-none cursor-pointer accent-primary border border-border"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-text-primary">Enable Subtitle Transcription</p>
                <p className="text-xs text-text-secondary">Render recruiter dialogue texts during audio streaming.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={subtitlesEnabled}
                aria-label="Enable Subtitle Transcription"
                onClick={() => setSubtitlesEnabled(!subtitlesEnabled)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                  subtitlesEnabled ? 'bg-primary' : 'bg-bg-surface-alt border border-border'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-bg-surface shadow ring-0 transition duration-200 ease-in-out ${
                    subtitlesEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-text-primary">Voice Preview</p>
                <p className="text-xs text-text-secondary">Listen to how the AI recruiter sounds with your current speed and pitch.</p>
              </div>
              <button
                type="button"
                onClick={handleTestVoice}
                disabled={!speechSupported || isSpeakingTest}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-bg-surface-alt hover:bg-border text-xs font-semibold text-text-primary border border-border transition duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                title={speechSupported ? 'Test voice synthesis' : 'Speech synthesis is not supported in this browser'}
              >
                <FaVolumeUp aria-hidden="true" className={isSpeakingTest ? 'text-primary animate-pulse' : 'text-text-secondary'} />
                <span>{isSpeakingTest ? 'Testing...' : 'Test voice'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Custom Visual Studio Theme Switcher Section */}
        <div className="bg-bg-surface border border-border rounded-2xl p-6 relative shadow-soft">
          <ThemeSwitcher />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border items-center">
          <motion.div
            animate={{ opacity: saved ? 1 : 0, x: saved ? 0 : 10 }}
            className="flex items-center gap-2 text-success text-xs font-semibold mr-auto"
          >
            <FaCheckCircle aria-hidden="true" />
            <span>Preferences saved successfully!</span>
          </motion.div>

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary-hover active:bg-primary-active font-semibold text-xs text-text-on-primary hover:scale-102 active:scale-98 transition duration-250 cursor-pointer shadow-soft disabled:opacity-50"
          >
            <FaSave aria-hidden="true" />
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
