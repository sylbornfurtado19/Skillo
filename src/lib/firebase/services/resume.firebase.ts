import {
  ref,
  uploadBytes,
  deleteObject,
  getDownloadURL,
} from 'firebase/storage';
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db, storage } from '../config';
import type { ResumeRecord, ServiceResponse } from '../../../types/index';

const COLLECTION_NAME = 'resumes';

export const uploadResume = async (
  file: File,
  userId: string
): Promise<ServiceResponse<ResumeRecord>> => {
  try {
    const fileExt = file.name.split('.').pop();
    const filePath = `resumes/${userId}/${Date.now()}.${fileExt}`;
    const storageRef = ref(storage, filePath);

    // Upload to Firebase Cloud Storage
    await uploadBytes(storageRef, file, {
      contentType: file.type,
      customMetadata: { userId, originalName: file.name },
    });

    // Save record to Firestore
    const docPayload = {
      user_id: userId,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      mime_type: file.type,
      created_at: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), docPayload);

    const record = {
      id: docRef.id,
      ...docPayload,
    } as unknown as ResumeRecord;

    return { data: record, error: null };
  } catch (err: unknown) {
    return { data: null, error: err };
  }
};

export const deleteResume = async (
  resumeId: string,
  filePath: string
): Promise<ServiceResponse<unknown>> => {
  try {
    // 1. Delete file from Firebase Storage
    if (filePath) {
      try {
        const storageRef = ref(storage, filePath);
        await deleteObject(storageRef);
      } catch (storageErr) {
        console.warn('[Firebase Storage] Could not delete object:', storageErr);
      }
    }

    // 2. Delete document from Firestore
    await deleteDoc(doc(db, COLLECTION_NAME, resumeId));
    return { data: true, error: null };
  } catch (err: unknown) {
    return { data: null, error: err };
  }
};

export const getResumes = async (
  userId: string
): Promise<ServiceResponse<ResumeRecord[]>> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('user_id', '==', userId),
      orderBy('created_at', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const resumes: ResumeRecord[] = [];
    querySnapshot.forEach((docSnap) => {
      resumes.push({
        id: docSnap.id,
        ...docSnap.data(),
      } as unknown as ResumeRecord);
    });

    return { data: resumes, error: null };
  } catch (err: unknown) {
    return { data: null, error: err };
  }
};

export const getResumeDownloadUrl = async (
  filePath: string
): Promise<ServiceResponse<string>> => {
  try {
    const storageRef = ref(storage, filePath);
    const url = await getDownloadURL(storageRef);
    return { data: url, error: null };
  } catch (err: unknown) {
    return { data: null, error: err };
  }
};
