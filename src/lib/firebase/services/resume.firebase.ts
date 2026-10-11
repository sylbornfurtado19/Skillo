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

    // 1. Try uploading to Firebase Cloud Storage if available (optional)
    try {
      if (storage) {
        const storageRef = ref(storage, filePath);
        await uploadBytes(storageRef, file, {
          contentType: file.type,
          customMetadata: { userId, originalName: file.name },
        });
      }
    } catch (storageErr) {
      console.warn(
        '[Firebase Storage] Cloud Storage is not enabled or requires Blaze plan. Storing resume record directly in Firestore database:',
        storageErr
      );
    }

    // 2. Always persist record in Firestore database
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
    // 1. Try deleting from Firebase Storage if it exists
    if (filePath && storage) {
      try {
        const storageRef = ref(storage, filePath);
        await deleteObject(storageRef);
      } catch (storageErr) {
        // Silently ignore if file didn't exist in storage bucket
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
    if (!storage) {
      return { data: '', error: null };
    }
    const storageRef = ref(storage, filePath);
    const url = await getDownloadURL(storageRef);
    return { data: url, error: null };
  } catch {
    // Cloud storage not configured or file not stored in bucket
    return { data: '', error: null };
  }
};
