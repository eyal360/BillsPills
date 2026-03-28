import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

export const authRouter = Router();

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
