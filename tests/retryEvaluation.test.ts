import {
  handleRetryEvaluationSuccess,
  handleRetryEvaluationFailure,
} from '@/components/interview/session/sessionHelpers';

describe('Retry Evaluation Helpers', () => {
  it('extracts newScore and feedback on success', () => {
    const report = {
      overallScore: 92,
      breakdown: [
        { feedback: 'Outstanding trade-off discussion and clear complexity analysis.' },
      ],
    };

    const result = handleRetryEvaluationSuccess(report);
    expect(result.newScore).toBe(92);
    expect(result.feedback).toBe('Outstanding trade-off discussion and clear complexity analysis.');
  });

  it('provides default feedback if breakdown is empty or missing', () => {
    const report = {
      overallScore: 75,
      breakdown: [],
    };

    const result = handleRetryEvaluationSuccess(report);
    expect(result.newScore).toBe(75);
    expect(result.feedback).toBe('Demonstrated improved response clarity.');
  });

  it('keeps previous score on failure and returns error toast message without modifying score', () => {
    const error = new Error('Network error or model timeout');
    const failureResult = handleRetryEvaluationFailure(error);

    expect(failureResult.toastMessage).toBe('Retry evaluation failed. Your previous score was kept.');
    expect(failureResult.toastType).toBe('error');
    expect(failureResult.grading).toBe(false);
  });
});
