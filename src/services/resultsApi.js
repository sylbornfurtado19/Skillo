// Results and feedback API service for InterviewIQ
import { simulateDelay } from './api';

/**
 * Generates final evaluation report based on user answers (internal helper fallback)
 */
export const generateFeedbackReport = (setupData, questionsList, answersList) => {
  const scores = {
    technicalAccuracy: 75 + Math.floor(Math.random() * 20), // 75 - 95
    communication: 80 + Math.floor(Math.random() * 15),     // 80 - 95
    depth: 70 + Math.floor(Math.random() * 25),            // 70 - 95
    timeManagement: 85 + Math.floor(Math.random() * 12),    // 85 - 97
  };

  // Average score
  const overallScore = Math.round(
    (scores.technicalAccuracy + scores.communication + scores.depth + scores.timeManagement) / 4
  );

  const questionFeedbacks = questionsList.map((q, index) => {
    const userAnswer = answersList[index] || "No answer provided.";
    const scoreVal = 70 + (index * 6 + (userAnswer.length % 20)) % 25; // pseudo-dynamic score
    
    let communicationFeedback = "";
    let technicalFeedback = "";
    let suggestions = [];

    if (setupData.type === 'technical') {
      technicalFeedback = "Good usage of technical terms. You successfully touched on key structural mechanics.";
      communicationFeedback = "Your description was logical and easy to follow.";
      suggestions = [
        "Include more concrete examples of how you applied this in a past production system.",
        "Mention the time complexity or rendering overhead details to showcase senior depth."
      ];
    } else if (setupData.type === 'behavioral') {
      technicalFeedback = "Strong narrative alignment. You set the context and actions clearly.";
      communicationFeedback = "Great usage of the STAR framework (Situation, Task, Action, Result).";
      suggestions = [
        "Provide more specific metrics on the outcome (e.g. numbers, percentages, times saved).",
        "Explain what you would do differently in hindsight."
      ];
    } else {
      technicalFeedback = "Your high level block diagram elements were well described.";
      communicationFeedback = "Clear explanation of network interfaces and data stores.";
      suggestions = [
        "Discuss scalability limitations and point out single points of failure (SPOFs).",
        "Consider caching and database read/write ratios."
      ];
    }

    return {
      id: q.id,
      question: q.question,
      userAnswer,
      score: scoreVal,
      idealConcepts: q.hint || "Core concepts related to the topic.",
      feedback: `${technicalFeedback} ${communicationFeedback}`,
      suggestions,
      strengths: userAnswer.length > 80 ? "Detailed response structure, use of industry terminology." : "Direct, straightforward communication."
    };
  });

  return {
    overallScore,
    categories: scores,
    breakdown: questionFeedbacks,
    interviewerComments: `You performed well during this ${setupData.type} interview. Your structural clarity stands out, and you communicate technical decisions with strong confidence. Focus on providing quantitative evidence in behavioral tracks and detailing edge cases in technical tracks to elevate your performance further.`,
    personaId: setupData.persona,
    setupData
  };
};

/**
 * Async API: Submit candidate answers and receive comprehensive AI grading dashboard
 * Supports connecting to Claude API if a valid key is provided.
 */
export const submitInterviewAnswers = async (setupData, questionsList, answersList, apiKey = '', showToast = null) => {
  if (!apiKey || apiKey === 'sk-proj-••••••••••••••••••••' || apiKey.startsWith('sk-proj-')) {
    // If it's a mock key or empty, fallback to mock generation!
    console.log("No valid Anthropic API Key. Falling back to simulated scoring.");
    await simulateDelay(2500);
    return generateFeedbackReport(setupData, questionsList, answersList);
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: `You are an expert technical interviewer and career coach. Grade the following mock interview.
Role: ${setupData.role}
Domain: ${setupData.domain}
Seniority: ${setupData.experienceLevel}
Track Type: ${setupData.type}
Difficulty: ${setupData.difficulty}

Questions and candidate answers:
${questionsList.map((q, idx) => `
Question ${idx + 1}: ${q.question}
Candidate Answer: ${answersList[idx] || "No response provided."}
`).join('\n')}

Evaluate the answers rigorously. Provide constructive feedback, strengths, weaknesses, and a concrete study plan.
You MUST respond with a single valid JSON object following this EXACT structure:
{
  "overallScore": 85,
  "categories": {
    "technicalAccuracy": 80,
    "communication": 85,
    "depth": 75,
    "timeManagement": 90
  },
  "interviewerComments": "Detailed high-level review text summarizing overall performance.",
  "breakdown": [
    {
      "id": "id of the question",
      "question": "question string",
      "userAnswer": "answer string",
      "score": 85,
      "feedback": "specific feedback on this answer",
      "strengths": "strengths in this answer",
      "suggestions": ["suggestion 1", "suggestion 2"]
    }
  ],
  "strengths": [
    "global strength 1",
    "global strength 2",
    "global strength 3"
  ],
  "weaknesses": [
    "global weakness 1",
    "global weakness 2"
  ],
  "plan": [
    {
      "topic": "topic name",
      "desc": "concrete action items"
    }
  ]
}

Return ONLY this JSON object. Do not include markdown code block syntax. Do not write any conversational text before or after the JSON.`
          }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API Error (Status ${response.status}): ${errText}`);
    }

    const data = await response.json();
    let cleanText = data.content[0].text;
    
    // Fallback parser if codeblocks slip through
    if (cleanText.includes("```")) {
      cleanText = cleanText.split("```")[1];
      if (cleanText.startsWith("json")) {
        cleanText = cleanText.substring(4);
      }
    }
    cleanText = cleanText.trim();
    
    const report = JSON.parse(cleanText);
    
    return {
      ...report,
      personaId: setupData.persona,
      setupData
    };
  } catch (error) {
    console.error("Failed to fetch Claude grading report:", error);
    if (showToast) {
      showToast(`Claude API evaluation failed: ${error.message}. Falling back to simulated reports.`, 'error');
    }
    return generateFeedbackReport(setupData, questionsList, answersList);
  }
};
