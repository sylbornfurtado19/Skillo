import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config';
import type { MockInterview, MockInterviewInsert, ServiceResponse } from '../../../types/index';

const COLLECTION_NAME = 'mock_interviews';

export const saveMockInterview = async (
  userId: string,
  interviewData: MockInterviewInsert
): Promise<ServiceResponse<MockInterview>> => {
  try {
    const payload = {
      user_id: userId,
      domain: interviewData.domain,
      role: interviewData.role,
      experience_level: interviewData.experience_level,
      interview_type: interviewData.interview_type,
      persona: interviewData.persona,
      overall_score: interviewData.overall_score,
      categories: interviewData.categories || {},
      breakdown: interviewData.breakdown || [],
      interviewer_comments: interviewData.interviewer_comments || '',
      company: interviewData.company ?? 'Generic',
      duration: interviewData.duration ?? 45,
      interview_mode_id: interviewData.interview_mode_id ?? 'generic-technical',
      system_design_diagram: interviewData.system_design_diagram ?? {},
      created_at: interviewData.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _serverTimestamp: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), payload);
    const savedRecord: MockInterview = {
      id: docRef.id,
      ...payload,
    } as unknown as MockInterview;

    return { data: savedRecord, error: null };
  } catch (err: unknown) {
    return { data: null, error: err };
  }
};

export const getMockInterviews = async (
  userId: string
): Promise<ServiceResponse<MockInterview[]>> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('user_id', '==', userId),
      orderBy('created_at', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const interviews: MockInterview[] = [];
    querySnapshot.forEach((docSnap) => {
      interviews.push({
        id: docSnap.id,
        ...docSnap.data(),
      } as unknown as MockInterview);
    });

    return { data: interviews, error: null };
  } catch (err: unknown) {
    return { data: null, error: err };
  }
};

export const getMockInterviewById = async (
  interviewId: string
): Promise<ServiceResponse<MockInterview>> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, interviewId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return { data: null, error: new Error('Mock interview record not found') };
    }

    const interview = {
      id: docSnap.id,
      ...docSnap.data(),
    } as unknown as MockInterview;

    return { data: interview, error: null };
  } catch (err: unknown) {
    return { data: null, error: err };
  }
};
