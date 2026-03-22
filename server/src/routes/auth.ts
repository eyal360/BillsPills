import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';

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
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  let { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // If profile doesn't exist (e.g. first Google login), create it
  if (!profile && profileError?.code === 'PGRST116') {
    const { data: newProfile, error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
        role: 'user',
      })
      .select('*')
      .single();
    
    if (!insertError) {
      profile = newProfile;
    }
  }

  res.json({ id: user.id, email: user.email, ...profile });
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
