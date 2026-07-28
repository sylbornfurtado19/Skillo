// Resume API service for InterviewIQ
import { simulateDelay } from './api';

/**
 * Generates a mock analysis report for uploaded resume (internal helper)
 */
export const simulateResumeAnalysis = (fileName, jobTitle, jobDesc) => {
  const commonKeywords = ['React', 'TypeScript', 'JavaScript', 'Tailwind', 'Git', 'REST API', 'Vite', 'State Management'];
  const missingKeywords = ['Next.js', 'GraphQL', 'Docker', 'CI/CD', 'Jest/Cypress', 'System Design'];
  
  // Calculate match percentage based on inputs (pseudo-random but realistic)
  const lengthScore = Math.min(25, Math.floor(jobTitle.length + jobDesc.length / 10));
  const baseMatch = 65 + (lengthScore % 20); // range 65% - 85%
  
  return {
    matchPercentage: baseMatch,
    fileName,
    skillsMatched: commonKeywords.slice(0, 4 + (baseMatch % 4)),
    skillsMissing: missingKeywords.slice(0, 2 + (baseMatch % 3)),
    summary: `Your resume demonstrates a strong foundational match for the ${jobTitle || 'Software Engineer'} role. Key highlights include hands-on experience with modern frontend practices and responsive design systems. To improve compatibility, consider adding more references to full-stack integration and testing tools.`,
    scoreBreakdown: {
      formatting: 90,
      skills: baseMatch + 2,
      experienceRelevance: baseMatch - 5,
      impactMetrics: 72
    },
    recommendations: [
      `Quantify accomplishments with metrics (e.g., 'Optimized render cycles leading to a 30% reduction in TTI').`,
      `Add explicit mentions of ${missingKeywords[0]} and ${missingKeywords[1]} to pass recruiter screening.`,
      `Include testing workflows such as unit tests with Vitest/Jest or end-to-end integration.`
    ]
  };
};

/**
 * Async API: Upload resume and return parsed/analyzed details
 * @param {File} file 
 * @param {string} jobTitle 
 * @param {string} jobDesc 
 * @returns {Promise<Object>}
 */
export const uploadResume = async (file, jobTitle, jobDesc) => {
  await simulateDelay(2500); // simulate document scanning & processing latency
  return simulateResumeAnalysis(file.name, jobTitle, jobDesc);
};
