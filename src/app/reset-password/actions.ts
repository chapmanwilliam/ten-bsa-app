'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function resetPassword(newPassword: string): Promise<{ error?: string }> {
  // Get the current user from the recovery session
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: 'No valid session. Please request a new reset link.' };
  }

  // Use admin client to update the password (bypasses session permission issues)
  const admin = createAdminClient();
  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    password: newPassword,
  });

  if (updateError) {
    return { error: updateError.message };
  }

  // Sign out the recovery session
  await supabase.auth.signOut();

  return {};
}
