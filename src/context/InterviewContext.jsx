import React, { createContext, useContext, useState, useEffect } from 'react';

const InterviewContext = createContext();

export const useInterview = () => {
  const context = useContext(InterviewContext);
  if (!context) {
    throw new Error('useInterview must be used within an InterviewProvider');
  }
  return context;
};

export const InterviewProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    // Placeholder for Supabase Auth session check:
    // const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => { ... });
    setIsAuthLoading(false);
  }, []);

  // Theme State
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('iq_theme') || 'dark';
  });

  useEffect(() => {
    localStorage.setItem('iq_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Anthropic API Key for real evaluations
  const [apiKey, _setApiKey] = useState(localStorage.getItem('anthropic_api_key') || '');

  const setApiKey = (key) => {
    _setApiKey(key);
    if (key) {
      localStorage.setItem('anthropic_api_key', key);
    } else {
      localStorage.removeItem('anthropic_api_key');
    }
  };

  // Rehydrate values from sessionStorage if they exist
  const [resumeData, setResumeData] = useState(() => {
    try {
      const data = sessionStorage.getItem('iq_resume_data');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  });

  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null); // { matchPercentage, keyKeywords, suggestions, skillsMatched: [] }
  
  const [setupData, setSetupData] = useState(() => {
    try {
      const data = sessionStorage.getItem('iq_setup_data');
      return data ? JSON.parse(data) : {
        domain: 'Computer Science',
        role: 'Software Engineer',
        experienceLevel: 'Mid-Level',
        type: 'Technical',
        difficulty: 'Medium',
        questionCount: 5,
        focusAreas: [],
        persona: 'sarah',
      };
    } catch {
      return {
        domain: 'Computer Science',
        role: 'Software Engineer',
        experienceLevel: 'Mid-Level',
        type: 'Technical',
        difficulty: 'Medium',
        questionCount: 5,
        focusAreas: [],
        persona: 'sarah',
      };
    }
  });

  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState([]); // Array of strings or object { questionId, answerText, timeSpent, speakMode }
  
  const [results, _setResults] = useState(() => {
    try {
      const data = sessionStorage.getItem('iq_results');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  });

  const [sessionHistory, setSessionHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('session_history')) || [];
    } catch {
      return [];
    }
  });

  // Save to sessionStorage when state changes
  useEffect(() => {
    if (resumeData) {
      sessionStorage.setItem('iq_resume_data', JSON.stringify(resumeData));
    } else {
      sessionStorage.removeItem('iq_resume_data');
    }
  }, [resumeData]);

  useEffect(() => {
    sessionStorage.setItem('iq_setup_data', JSON.stringify(setupData));
  }, [setupData]);

  useEffect(() => {
    if (results) {
      sessionStorage.setItem('iq_results', JSON.stringify(results));
    } else {
      sessionStorage.removeItem('iq_results');
    }
  }, [results]);

  const setResults = (newResults) => {
    _setResults(newResults);
    if (newResults) {
      const historyItem = {
        id: `session_${Date.now()}`,
        role: newResults.setupData?.role || 'Software Engineer',
        type: newResults.setupData?.type || 'Technical',
        difficulty: newResults.setupData?.experienceLevel || 'Mid-Level',
        date: new Date().toISOString().split('T')[0],
        score: newResults.overallScore,
        persona: newResults.personaId || 'sarah',
      };
      setSessionHistory((prev) => {
        const updated = [historyItem, ...prev];
        localStorage.setItem('session_history', JSON.stringify(updated));
        return updated;
      });
    }
  };

  const loginMock = (userData) => {
    setIsAuthenticated(true);
    if (userData && typeof userData === 'object' && userData.email) {
      setUser(userData);
    } else {
      setUser({
        name: 'Alex Mercer',
        email: typeof userData === 'string' ? userData : 'alex.mercer@gmail.com',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=120',
      });
    }
  };

  const logoutMock = async () => {
    // Placeholder for Supabase signOut:
    // await supabase.auth.signOut();
    setIsAuthenticated(false);
    setUser(null);
    resetSession();
  };

  const resetSession = () => {
    setResumeData(null);
    setJobTitle('');
    setJobDescription('');
    setAnalysisResult(null);
    setSetupData({
      domain: 'Computer Science',
      role: 'Software Engineer',
      experienceLevel: 'Mid-Level',
      type: 'Technical',
      difficulty: 'Medium',
      questionCount: 5,
      focusAreas: [],
      persona: 'sarah',
    });
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setAnswers([]);
    _setResults(null);
    sessionStorage.removeItem('iq_resume_data');
    sessionStorage.removeItem('iq_setup_data');
    sessionStorage.removeItem('iq_results');
  };

  const value = {
    isAuthenticated,
    user,
    loginMock,
    logoutMock,
    apiKey,
    setApiKey,
    resumeData,
    setResumeData,
    jobTitle,
    setJobTitle,
    jobDescription,
    setJobDescription,
    analysisResult,
    setAnalysisResult,
    setupData,
    setSetupData,
    questions,
    setQuestions,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    answers,
    setAnswers,
    results,
    setResults,
    sessionHistory,
    setSessionHistory,
    resetSession,
    setTheme,
    isAuthLoading,
  };

  return (
    <InterviewContext.Provider value={value}>
      {children}
    </InterviewContext.Provider>
  );
};
