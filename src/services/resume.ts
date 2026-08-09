import { supabase } from '../lib/supabase';
import type { ResumeRecord, ServiceResponse } from '../types/index';

const BUCKET_NAME = 'resumes';

export const uploadResume = async (
  file: File,
  userId: string
): Promise<ServiceResponse<ResumeRecord>> => {
  try {
    const fileExt = file.name.split('.').pop();
    const filePath = `${userId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, { upsert: true });

    if (uploadError) return { data: null, error: uploadError };

    const { data: dbData, error: dbError } = await supabase
      .from('resumes')
      .insert([
        {
          user_id: userId,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
        },
      ])
      .select()
      .single();

    return { data: dbData as ResumeRecord, error: dbError };
  } catch (err: unknown) {
    return { data: null, error: err };
  }
};

export const deleteResume = async (
  resumeId: string,
  filePath: string
): Promise<ServiceResponse<unknown>> => {
  try {
    const { error: storageError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (storageError) return { data: null, error: storageError };

    const { data, error } = await supabase
      .from('resumes')
      .delete()
      .eq('id', resumeId);

    return { data, error };
  } catch (err: unknown) {
    return { data: null, error: err };
  }
};

export const listResumes = async (
  userId: string
): Promise<ServiceResponse<ResumeRecord[]>> => {
  try {
    const { data, error } = await supabase
      .from('resumes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    return { data: data as ResumeRecord[], error };
  } catch (err: unknown) {
    return { data: null, error: err };
  }
};

export const getSignedUrl = async (
  filePath: string,
  expiresIn = 3600
): Promise<ServiceResponse<string>> => {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, expiresIn);

    return { data: data?.signedUrl ?? null, error };
  } catch (err: unknown) {
    return { data: null, error: err };
  }
};
