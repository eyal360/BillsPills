import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

export const authRouter = Router();

// Store Google OAuth tokens for Drive access (called client-side after Google login)
authRouter.post('/google-token', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { provider_token, provider_refresh_token } = req.body;
  const userId = req.user!.id;

  if (!provider_refresh_token) {
    // Access token only — still save it, but warn that refresh is missing
    logger.warn(`[Drive] No refresh token received for user ${userId}. Drive sync may fail after token expiry.`);
  }

  try {
    // Only write fields that were actually supplied.
    // CRITICAL: google_token_expiry must only be updated together with a fresh
    // provider_token — otherwise the expiry timestamps a stale/expired token as valid.
    const updateData: Record<string, any> = {};

    if (provider_token) {
      updateData.google_access_token = provider_token;
      updateData.google_token_expiry = Date.now() + 3600 * 1000; // 1 hour from now
    }

    if (provider_refresh_token) {
      updateData.google_refresh_token = provider_refresh_token;
    }

    if (Object.keys(updateData).length === 0) {
      logger.warn(`[Drive] /google-token called but provider sent no tokens for user ${userId} — nothing stored`);
      res.json({ ok: true });
      return;
    }

    const { error } = await supabase.from('profiles').update(updateData).eq('id', userId);
    if (error) throw error;

    logger.info(`[Drive] Stored Google tokens for user ${userId} (hasAccess: ${!!provider_token}, hasRefresh: ${!!provider_refresh_token})`);
    res.json({ ok: true });
  } catch (err: any) {
    logger.error('[Drive] Failed to store Google tokens:', err.message);
    res.status(500).json({ error: 'Failed to store Google tokens' });
  }
});

// Check if user has Google Drive tokens stored
authRouter.get('/drive-status', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('google_refresh_token')
    .eq('id', req.user!.id)
    .single();

  res.json({ hasTokens: !!(profile?.google_refresh_token) });
});

// Force-refresh the stored Google access token by zeroing the expiry.
// This causes getValidAccessToken() to immediately refresh via the stored refresh_token.
// Use this to recover from a stale-token state without requiring a full re-login.
authRouter.post('/force-drive-refresh', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  try {
    // Zero the expiry — getValidAccessToken will see it as expired and auto-refresh
    await supabase.from('profiles').update({ google_token_expiry: 0 }).eq('id', userId);
    logger.info(`[Drive] Forced token expiry reset for user ${userId}`);
    res.json({ ok: true, message: 'Token expiry reset. Next Drive operation will auto-refresh.' });
  } catch (err: any) {
    logger.error('[Drive] Failed to reset token expiry:', err.message);
    res.status(500).json({ error: 'Failed to reset token expiry' });
  }
});


// Login
authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password required' });
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    res.status(401).json({ error: error.message });
    return;
  }

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  res.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    user: {
      id: data.user.id,
      email: data.user.email,
      ...profile,
    },
  });
});

// Logout
authRouter.post('/logout', async (_req: Request, res: Response): Promise<void> => {
  await supabase.auth.signOut();
  res.json({ message: 'Logged out' });
});

// Get current user
authRouter.get('/me', async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    logger.info(`Auth /me called - header present: ${!!authHeader}`);
    
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      res.status(401).json({ error: 'Invalid session' });
      return;
    }

    let { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // If profile doesn't exist, create it
    if (!profile) {
      const { data: newProfile } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
          role: 'user',
        })
        .select('*')
        .single();
      
      profile = newProfile;
    }

    res.json({ 
      id: user.id, 
      email: user.email, 
      ...(profile || {}) 
    });
  } catch (err: any) {
    logger.error('Auth /me error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Register (for demo/admin setup)
authRouter.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { email, password, full_name } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password required' });
    return;
  }

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  if (data.user) {
    await supabase.from('profiles').insert({
      id: data.user.id,
      full_name,
      role: 'user',
    });
  }

  res.json({ message: 'Registration successful. Please check your email.' });
});

// Delete Account (Nuclear Option)
authRouter.delete('/account', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const userEmail = req.user!.email.toLowerCase();

  logger.info(`🚨 DELETE ACCOUNT REQUEST: User ${userId} (${userEmail})`);

  try {
    // 1. Get all properties owned by the user
    const { data: ownedProperties, error: propError } = await supabase
      .from('properties')
      .select('id')
      .eq('user_id', userId);

    if (propError) throw propError;
    const ownedIds = ownedProperties?.map((p: any) => p.id) || [];

    // 2. Anonymize contributions to SHARED properties (not owned by user)
    // We set user_id to NULL to preserve the data without the user record.
    // This must happen before deleting the user from auth.users (due to potential cascades).
    
    // 2. Preserve contributions to SHARED properties (not owned by user)
    // We reassign them to the property owner to satisfy NOT NULL constraints.
    
    // Find shared properties where the user has bills or events
    let sharedQuery = supabase
      .from('bills')
      .select('id, property_id, properties!inner(user_id)')
      .eq('user_id', userId);
    
    // Only exclude properties if the user has any
    if (ownedIds.length > 0) {
      sharedQuery = sharedQuery.not('property_id', 'in', `(${ownedIds.join(',')})`);
    }

    const { data: sharedBills, error: sharedBillsErr } = await sharedQuery;

    if (sharedBillsErr) logger.error('Error fetching shared bills:', sharedBillsErr);

    if (sharedBills && sharedBills.length > 0) {
      for (const bill of sharedBills) {
        const ownerId = (bill.properties as any).user_id;

        // Reassign the bill itself
        await supabase.from('bills').update({ user_id: ownerId }).eq('id', bill.id);

        // Reassign all events for this bill created by the deleting user
        await supabase.from('bill_events').update({ user_id: ownerId }).eq('bill_id', bill.id).eq('user_id', userId);
      }
      logger.info(`✅ Reassigned ${sharedBills.length} shared bills/events to property owners.`);
    }

    // Safety: Delete ANY remaining data created by this user that would block account deletion
    // (e.g. events on bills we missed, or other future relations)
    await supabase.from('bill_events').delete().eq('user_id', userId);
    await supabase.from('bills').delete().eq('user_id', userId);

    // 3. Delete Owned Data
    // Delete properties (triggers cascade to bills, events, shares, etc.)
    if (ownedIds.length > 0) {
      const { error: deletePropsErr } = await supabase
        .from('properties')
        .delete()
        .in('id', ownedIds);
      if (deletePropsErr) throw deletePropsErr;
      
      // Also delete bill_documents (RAG) which might not cascade
      await supabase.from('bill_documents').delete().in('property_id', ownedIds);
    }

    // 4. Cleanup remaining shares (where user was a guest)
    await supabase.from('property_shares').delete().eq('email', userEmail);

    // 5. Delete Profile
    await supabase.from('profiles').delete().eq('id', userId);

    // 6. Delete Auth User (Supabase Admin)
    const { error: authDeleteErr } = await supabase.auth.admin.deleteUser(userId);
    if (authDeleteErr) throw authDeleteErr;

    logger.info(`✅ Account successfully deleted for ${userId}`);
    res.json({ message: 'Account and data successfully removed.' });
  } catch (err: any) {
    logger.error('CRITICAL: Failed to delete account:', err);
    res.status(500).json({ error: 'Failed to process account deletion. Please contact support.' });
  }
});
