import { Router } from 'express';
import { getSupabase } from '../lib/supabase.js';

const router = Router();

// Interceptador para rotas /public/curso/:slug e /public/trilha/:slug
router.get(['/public/curso/:slug', '/public/trilha/:slug'], async (req, res) => {
  const { slug } = req.params;
  const isTrilha = req.path.includes('/trilha/');
  
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
    const idColumn = isUuid ? 'id' : 'slug';
    
    const supabase = getSupabase();
    const table = isTrilha ? 'trilhas' : 'cursos';
    
    const { data: curso, error: cursoErr } = await supabase
      .from(table)
      .select('nome, descricao, thumbnail_url, capa_url')
      .eq(idColumn, slug)
      .single();

    const debugError = cursoErr ? JSON.stringify(cursoErr) : 'none';

    // Busca o index.html gerado pelo Vite (servido pela Vercel na rota principal /)
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const baseUrl = `${protocol}://${host}`;
    
    let html = '';
    try {
      const response = await fetch(`${baseUrl}/`);
      if (response.ok) {
        html = await response.text();
      } else {
        throw new Error('Falha ao buscar index.html base');
      }
    } catch (e) {
      console.error('Erro no fetch do index:', e);
      // Fallback básico caso o fetch falhe
      html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Página não encontrada</title></head><body><script>window.location.href="/";</script></body></html>`;
    }

    if (curso) {
      const imageUrl = curso.thumbnail_url || curso.capa_url || '';
      const title = curso.nome?.replace(/"/g, '&quot;') || 'Curso Online';
      const description = curso.descricao?.substring(0, 150)?.replace(/"/g, '&quot;') || 'Acesse a página de vendas para mais detalhes.';
      
      const ogTags = `
        <title>${title}</title>
        <meta property="og:title" content="${title}" />
        <meta property="og:description" content="${description}..." />
        ${imageUrl ? `<meta property="og:image" content="${imageUrl}" />` : ''}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="${title}" />
        <meta name="twitter:description" content="${description}..." />
        ${imageUrl ? `<meta name="twitter:image" content="${imageUrl}" />` : ''}
        <meta name="x-debug" content="curso-encontrado" />
      `;
      
      html = html.replace('</head>', `\n${ogTags}\n</head>`);
    } else {
      html = html.replace('</head>', `\n<meta name="x-debug" content="curso-nao-encontrado" /><meta name="x-err" content='${debugError}' />\n</head>`);
    }

    res.send(html);
  } catch (error) {
    console.error('Erro na rota OG:', error);
    res.redirect('/');
  }
});

export default router;
