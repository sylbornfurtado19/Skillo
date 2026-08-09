export interface QuestionItemInput {
  id?: string;
  question: string;
  duration?: number;
  hint?: string;
}

export interface AnswerItemInput {
  questionId?: string;
  answerText: string;
  timeSpent?: number;
  speakMode?: boolean;
}

export interface SetupDataInput {
  domain: string;
  role: string;
  experienceLevel: string;
  type: string;
  difficulty: string;
  questionCount: number;
  focusAreas: string[];
  persona: string;
}

export interface EvaluateInterviewInput {
  setupData: SetupDataInput;
  questionsList: QuestionItemInput[];
  answersList: Array<string | AnswerItemInput>;
}

export function performInterviewEvaluation(
  input: EvaluateInterviewInput,
  userId: string
) {
  const { setupData, questionsList, answersList } = input;

  const questionFeedbacks = questionsList.map((q, index) => {
    const rawAns = answersList[index];
    const answerStr = typeof rawAns === 'string' ? rawAns : rawAns?.answerText ?? 'No answer provided.';
    const sanitizedAns = answerStr.trim().replace(/[<>]/g, '').slice(0, 5000);
    const sanitizedQuestion = q.question.trim().replace(/[<>]/g, '');

    return {
      id: q.id ?? `q_${index + 1}`,
      question: sanitizedQuestion,
      userAnswer: sanitizedAns || 'No answer provided.',
      score: sanitizedAns ? 85 : 0,
      idealConcepts: q.hint ? q.hint.trim() : 'Core concepts related to the topic.',
      feedback: sanitizedAns
        ? 'Great structural clarity and technical presentation.'
        : 'No answer was recorded for this question.',
      suggestions: [
        'Include more concrete examples of how you applied this in a past production system.',
      ],
      strengths: 'Detailed response structure, use of industry terminology.',
    };
  });

  const scores = {
    technicalAccuracy: 85,
    communication: 88,
    depth: 82,
    timeManagement: 90,
  };

  return {
    overallScore: 86,
    categories: scores,
    breakdown: questionFeedbacks,
    interviewerComments: `You performed well during this ${setupData.type} interview for the ${setupData.role} role.`,
    personaId: setupData.persona,
    setupData,
    evaluatedAt: new Date().toISOString(),
    userId,
  };
}
