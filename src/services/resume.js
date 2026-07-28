import { supabase } from '../lib/supabase';

const BUCKET_NAME = 'resumes';

export const uploadResume = async (file, userId) => {
  try {
    const fileExt = file.name.split('.').pop();
    const filePath = `${userId}/${Date.now()}.${fileExt}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, { upsert: true });

    if (uploadError) return { data: null, error: uploadError };

    // Record resume in database
    const { data: dbData, error: dbError } = await supabase
      .from('resumes')
      .insert([{
        user_id: userId,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type
      }])
      .select()
      .single();

    return { data: dbData || uploadData, error: dbError };
  } catch (error) {
    return { data: null, error };
  }
};

export const deleteResume = async (resumeId, filePath) => {
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
  } catch (error) {
    return { data: null, error };
  }
};

export const listResumes = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('resumes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const getSignedUrl = async (filePath, expiresIn = 3600) => {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, expiresIn);

    return { data: data?.signedUrl || null, error };
  } catch (error) {
    return { data: null, error };
  }
};
