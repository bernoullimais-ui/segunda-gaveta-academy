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
    
    const selectFields = isTrilha ? 'id, nome, descricao, thumbnail_url' : 'id, nome, descricao, thumbnail_url';
    const { data: curso, error: cursoErr } = await supabase
      .from(table)
      .select(selectFields)
      .eq(idColumn, slug)
      .single();

    let landingPage: any = null;
    if (curso) {
      const lpColumn = isTrilha ? 'trilha_id' : 'curso_id';
      const { data: lp } = await supabase.from('landing_pages').select('hero_video_url, about, hero_title, hero_subtitle').eq(lpColumn, curso.id).maybeSingle();
      if (lp) landingPage = lp;
    }

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
      let imageUrl = curso.thumbnail_url || '';
      if (!imageUrl && landingPage?.hero_video_url && !landingPage.hero_video_url.includes('youtube') && !landingPage.hero_video_url.includes('vimeo')) {
        imageUrl = landingPage.hero_video_url;
      }
      const title = landingPage?.hero_title || curso.nome?.replace(/"/g, '&quot;') || 'Curso Online';
      const rawDesc = landingPage?.hero_subtitle || landingPage?.about || curso.descricao || 'Acesse a página de vendas para mais detalhes.';
      const description = rawDesc.substring(0, 150).replace(/"/g, '&quot;');
      
      const absoluteUrl = `${protocol}://${host}${req.originalUrl || req.url}`;
      const imageType = imageUrl.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      
      const ogTags = `<title>${title}</title>
        <meta name="description" content="${description}..." />
        <meta property="og:title" content="${title}" />
        <meta property="og:description" content="${description}..." />
        <meta property="og:url" content="${absoluteUrl}" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Segunda Gaveta Academy" />
        ${imageUrl ? `
        <meta property="og:image" content="${imageUrl}" />
        <meta property="og:image:secure_url" content="${imageUrl}" />
        <meta property="og:image:type" content="${imageType}" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />` : ''}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="${title}" />
        <meta name="twitter:description" content="${description}..." />
        ${imageUrl ? `<meta name="twitter:image" content="${imageUrl}" />` : ''}
        <meta name="x-debug" content="curso-encontrado" />`;
      
      // Substitui o title original pelo bloco completo de OG tags no topo do head
      html = html.replace(/<title>.*?<\/title>/gi, ogTags);
    } else {
      html = html.replace('</head>', `\n<meta name="x-debug" content="curso-nao-encontrado" /><meta name="x-err" content='${debugError}' />\n</head>`);
    }

    res.send(html);
  } catch (error) {
    console.error('Erro na rota OG:', error);
    res.redirect('/');
  }
});

// Interceptador para a raiz (/) e (/login) em subdomínios de especialistas
router.get(['/', '/login'], async (req, res, next) => {
  const host = req.headers.host || '';
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const baseUrl = `${protocol}://${host}`;

  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
  const isMainDomain = 
    host === 'segundagavetaacademy.com.br' || 
    host === 'www.segundagavetaacademy.com.br' || 
    host === 'segundagaveta.com.br' ||
    host === 'www.segundagaveta.com.br' ||
    host.endsWith('.vercel.app');

  let projectSlug = '';
  if (!isLocalhost && !isMainDomain) {
    const parts = host.split('.');
    if (parts.length > 2) {
      projectSlug = parts[0];
    }
  }

  // Busca o index.html base (estático)
  let html = '';
  try {
    const response = await fetch(`${baseUrl}/index.html`);
    if (response.ok) {
      html = await response.text();
    } else {
      throw new Error('Falha ao buscar index.html base');
    }
  } catch (e) {
    console.error('Erro no fetch do index:', e);
    // Se falhar o fetch do index.html, deixa o Express seguir para servir estático
    return next();
  }

  if (projectSlug) {
    try {
      const supabase = getSupabase();
      const { data: org } = await supabase
        .from('organizacoes')
        .select('id, nome, logo_url, config_json')
        .eq('slug', projectSlug)
        .maybeSingle();

      if (org && org.config_json?.website_config) {
        const config = org.config_json.website_config;
        
        let specialistName = config.specialist_name?.trim() || org.nome;
        let specialistBio = config.specialist_bio?.trim() || 'Acesse nossa plataforma para conhecer nossos cursos e treinamentos.';
        let imageUrl = config.specialist_foto_url?.trim() || org.logo_url || '';
        
        // Se a foto do especialista estiver vazia, busca do primeiro curso publicado como fallback
        if (!imageUrl && org.id) {
          const { data: coursesData } = await supabase
            .from('cursos')
            .select('professor_foto_url')
            .eq('organizacao_id', org.id)
            .not('professor_foto_url', 'is', null)
            .limit(1);
          if (coursesData && coursesData.length > 0) {
            imageUrl = coursesData[0].professor_foto_url || '';
          }
        }

        // Garante que a URL da imagem seja absoluta para o preview de links
        if (imageUrl && !imageUrl.startsWith('http')) {
          imageUrl = `${baseUrl}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
        }

        const title = specialistName.replace(/"/g, '&quot;');
        const description = specialistBio.substring(0, 200).replace(/"/g, '&quot;');
        const absoluteUrl = `${protocol}://${host}${req.originalUrl || req.url}`;
        const imageType = imageUrl.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

        const ogTags = `<title>${title}</title>
        <meta name="description" content="${description}" />
        <meta property="og:title" content="${title}" />
        <meta property="og:description" content="${description}" />
        <meta property="og:url" content="${absoluteUrl}" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="${org.nome}" />
        ${imageUrl ? `
        <meta property="og:image" content="${imageUrl}" />
        <meta property="og:image:secure_url" content="${imageUrl}" />
        <meta property="og:image:type" content="${imageType}" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />` : ''}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="${title}" />
        <meta name="twitter:description" content="${description}" />
        ${imageUrl ? `<meta name="twitter:image" content="${imageUrl}" />` : ''}
        <meta name="x-debug" content="subdomain-og-encontrado" />`;

        html = html.replace(/<title>.*?<\/title>/gi, ogTags);
        return res.send(html);
      }
    } catch (err) {
      console.error('Erro ao injetar OG do subdomínio:', err);
    }
  }

  res.send(html);
});

export default router;
