import { Router } from 'express';
import { supabase } from './supabase.js';
import { AuthenticatedRequest, telegramAuth } from './auth.js';

const router = Router();
router.use(telegramAuth as any);

// Save user location
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { lat, lng, address } = req.body;
    const telegramId = req.telegramUser!.id;
    const ip = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '';

    const { data: user } = await supabase
      .from('users').select('id').eq('telegram_id', telegramId).single();

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Save to locations history
    await supabase.from('locations').insert({
      user_id: user.id, lat, lng, address, ip: typeof ip === 'string' ? ip : '',
    });

    // Update user's last location
    await supabase.from('users').update({
      last_location: { lat, lng, address, timestamp: new Date().toISOString() }
    }).eq('id', user.id);

    res.json({ success: true });
  } catch (err) {
    console.error('Location save error:', err);
    res.status(500).json({ error: 'Failed to save location' });
  }
});

export default router;
