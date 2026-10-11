import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../config';
import type { JobRecord, ServiceResponse } from '../../../types/index';

const COLLECTION_NAME = 'jobs';

export const getJobs = async (): Promise<ServiceResponse<JobRecord[]>> => {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy('created_at', 'desc'));
    const querySnapshot = await getDocs(q);
    const jobs: JobRecord[] = [];
    querySnapshot.forEach((docSnap) => {
      jobs.push({
        id: docSnap.id,
        ...docSnap.data(),
      } as JobRecord);
    });
    return { data: jobs, error: null };
  } catch (err: unknown) {
    return { data: null, error: err };
  }
};

export const createJob = async (
  jobData: Partial<JobRecord>
): Promise<ServiceResponse<JobRecord>> => {
  try {
    const payload = {
      ...jobData,
      created_at: new Date().toISOString(),
    };
    const docRef = await addDoc(collection(db, COLLECTION_NAME), payload);
    return { data: { id: docRef.id, ...payload } as JobRecord, error: null };
  } catch (err: unknown) {
    return { data: null, error: err };
  }
};
