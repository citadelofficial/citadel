import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

/**
 * Upload a profile avatar to Supabase Storage.
 * Returns the public URL on success, or null on failure.
 */
export async function uploadAvatar(
    userId: string,
    localUri: string
): Promise<string | null> {
    try {
        const fileExt = localUri.split('.').pop()?.toLowerCase() || 'jpg';
        const filePath = `${userId}/avatar.${fileExt}`;

        const base64 = await FileSystem.readAsStringAsync(localUri, {
            encoding: 'base64',
        });

        const { error } = await supabase.storage
            .from('avatars')
            .upload(filePath, decode(base64), {
                contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
                upsert: true,
            });

        if (error) {
            console.error('Avatar upload error:', error.message);
            return null;
        }

        const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
        // Append cache-buster so the image refreshes after updates
        return `${data.publicUrl}?t=${Date.now()}`;
    } catch (err) {
        console.error('Avatar upload exception:', err);
        return null;
    }
}

/**
 * Upload a file (scanned note, document, etc.) to Supabase Storage.
 * Returns the storage path on success, or null on failure.
 */
export async function uploadFile(
    userId: string,
    classId: string,
    localUri: string,
    fileName: string
): Promise<string | null> {
    try {
        const fileExt = localUri.split('.').pop()?.toLowerCase() || 'jpg';
        const filePath = `${userId}/${classId}/${fileName}.${fileExt}`;

        const base64 = await FileSystem.readAsStringAsync(localUri, {
            encoding: 'base64',
        });

        const contentType = fileExt === 'pdf'
            ? 'application/pdf'
            : fileExt === 'png'
                ? 'image/png'
                : 'image/jpeg';

        const { error } = await supabase.storage
            .from('user-files')
            .upload(filePath, decode(base64), {
                contentType,
                upsert: true,
            });

        if (error) {
            console.error('File upload error:', error.message);
            return null;
        }

        return filePath;
    } catch (err) {
        console.error('File upload exception:', err);
        return null;
    }
}

/**
 * Get a signed URL for a private file in user-files bucket.
 */
export async function getSignedUrl(
    path: string,
    expiresIn = 3600
): Promise<string | null> {
    const { data, error } = await supabase.storage
        .from('user-files')
        .createSignedUrl(path, expiresIn);

    if (error) {
        console.error('Signed URL error:', error.message);
        return null;
    }

    return data.signedUrl;
}

/**
 * Upload a scanned note image to Supabase Storage (public bucket)
 * so that other users in the same class can view it.
 * Returns the public URL on success, or null on failure.
 */
export async function uploadScanImage(
    localUri: string,
    fileName?: string
): Promise<string | null> {
    try {
        // Get the authenticated user's ID — required by RLS policies
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;
        if (!userId) {
            console.error('uploadScanImage: no authenticated user');
            return null;
        }

        const fileExt = localUri.split('.').pop()?.toLowerCase() || 'jpg';
        const name = fileName || `scan_${Date.now()}`;
        const filePath = `${userId}/scans/${name}.${fileExt}`;

        const base64 = await FileSystem.readAsStringAsync(localUri, {
            encoding: 'base64',
        });

        const contentType = fileExt === 'png' ? 'image/png' : 'image/jpeg';

        // Use 'avatars' bucket — it already has working RLS policies
        const { error } = await supabase.storage
            .from('avatars')
            .upload(filePath, decode(base64), {
                contentType,
                upsert: true,
            });

        if (error) {
            console.error('Scan image upload error:', error.message);
            return null;
        }

        const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
        return `${data.publicUrl}?t=${Date.now()}`;
    } catch (err) {
        console.error('Scan image upload exception:', err);
        return null;
    }
}
