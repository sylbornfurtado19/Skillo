// Career Setup and Roles Directory API for InterviewIQ
import { simulateDelay } from './api';

export const CAREER_DOMAINS = {
  'Computer Science': [
    'Software Engineer',
    'Frontend Developer',
    'Backend Developer',
    'Full Stack Developer',
    'Mobile App Developer',
    'DevOps Engineer',
    'Cloud Engineer',
    'Cybersecurity Analyst',
    'Network Engineer',
    'Database Engineer',
  ],
  'Artificial Intelligence': [
    'AI Engineer',
    'Machine Learning Engineer',
    'Deep Learning Engineer',
    'NLP Engineer',
    'Computer Vision Engineer',
    'Prompt Engineer',
  ],
  'Data & Analytics': [
    'Data Analyst',
    'Data Scientist',
    'Business Intelligence Analyst',
    'Data Engineer',
  ],
  'Finance': [
    'Financial Analyst',
    'Investment Analyst',
    'Equity Research Analyst',
    'Financial Planning Analyst',
  ],
  'Science & Education': [
    'Chemistry Teacher',
    'Physics Teacher',
    'Biology Teacher',
    'Mathematics Teacher',
    'Computer Science Teacher',
  ],
};

/**
 * Async API: Fetch list of supported career domains.
 * @returns {Promise<string[]>}
 */
export const fetchCareerDomains = async () => {
  await simulateDelay(300);
  return Object.keys(CAREER_DOMAINS);
};

/**
 * Async API: Fetch list of roles under a specific domain.
 * @param {string} domain 
 * @returns {Promise<string[]>}
 */
export const fetchRolesForDomain = async (domain) => {
  await simulateDelay(300);
  return CAREER_DOMAINS[domain] || [];
};
