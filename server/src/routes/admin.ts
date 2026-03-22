import { Router, Response } from 'express';
import { requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { supabase } from '../lib/supabase';

export const adminRouter = Router();

// GET all users
adminRouter.get('/users', requireAdmin, async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  // Get auth emails via admin API
  const { data: authUsers } = await supabase.auth.admin.listUsers();
  const emailMap: Record<string, string> = {};
  authUsers?.users?.forEach((u: any) => { emailMap[u.id] = u.email || ''; });

  const users = (profiles || []).map((p: any) => ({ ...p, email: emailMap[p.id] || '' }));
  res.json(users);
});

// GET user's properties (admin view)
adminRouter.get('/users/:userId/properties', requireAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('user_id', req.params.userId)
    .order('created_at', { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json(data);
});

// GET bills for a user's property (admin view)
adminRouter.get('/users/:userId/properties/:propertyId/bills', requireAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // Verify the property belongs to the specified user
  const { data: property } = await supabase
    .from('properties')
    .select('id')
    .eq('id', req.params.propertyId)
    .eq('user_id', req.params.userId)
    .single();

  if (!property) {
    res.status(404).json({ error: 'Property not found' });
    return;
  }

  const { data, error } = await supabase
    .from('bills')
    .select('*')
    .eq('property_id', req.params.propertyId)
    .order('bill_date', { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json(data);
});

// GET system stats
adminRouter.get('/stats', requireAdmin, async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const [usersRes, propertiesRes, billsRes] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('properties').select('id', { count: 'exact', head: true }),
    supabase.from('bills').select('id, amount, status', { count: 'exact' }),
  ]);

  const totalSpent = billsRes.data?.reduce((sum: number, b: any) => sum + (b.amount || 0), 0) || 0;
  const waitingCount = billsRes.data?.filter((b: any) => b.status === 'waiting').length || 0;

  res.json({
    totalUsers: usersRes.count || 0,
    totalProperties: propertiesRes.count || 0,
    totalBills: billsRes.count || 0,
    totalSpent,
    waitingCount,
  });
});
