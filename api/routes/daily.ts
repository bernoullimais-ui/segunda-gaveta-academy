import { Router } from 'express';
import fetch from 'node-fetch';

export const dailyRouter = Router();

// POST /api/daily/create-room
dailyRouter.post('/daily/create-room', async (req, res) => {
  try {
    const DAILY_API_KEY = process.env.DAILY_API_KEY || process.env.VITE_DAILY_API_KEY;
    
    if (!DAILY_API_KEY) {
      return res.status(500).json({ error: 'DAILY_API_KEY não configurada no servidor.' });
    }

    const response = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        privacy: 'public',
        properties: {
          enable_chat: true,
          enable_screenshare: true,
          start_audio_off: true,
          start_video_off: true,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Erro na API Daily:', errorData);
      return res.status(response.status).json({ error: 'Falha ao criar sala no Daily', details: errorData });
    }

    const data = await response.json() as any;
    return res.json({ url: data.url, name: data.name });
  } catch (error) {
    console.error('Erro ao criar sala Daily:', error);
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});
