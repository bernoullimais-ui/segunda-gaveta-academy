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
    
    const selectFields = isTrilha ? 'id, nome, descricao, thumbnail_url, capa_url' : 'id, nome, descricao, thumbnail_url, capa_url, professor_foto_url';
    const { data: curso, error: cursoErr } = await supabase
      .from(table)
      .select(selectFields)
      .eq(idColumn, slug)
      .single();

    let landingPage: any = null;
    if (curso) {
      const lpColumn = isTrilha ? 'trilha_id' : 'curso_id';
      const { data: lp } = await supabase.from('landing_pages').select('hero_video_url, about, hero_title, hero_subtitle, instructor').eq(lpColumn, curso.id).maybeSingle();
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
      let imageUrl = curso.capa_url || curso.thumbnail_url || landingPage?.instructor?.avatar_url || (curso as any).professor_foto_url || '';
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
        let imageUrl = '';
        if (config.hero_images && config.hero_images.length > 0 && config.hero_images[0].trim()) {
          imageUrl = config.hero_images[0].trim();
        }
        if (!imageUrl) {
          imageUrl = config.specialist_foto_url?.trim() || org.logo_url || '';
        }
        
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

        const ogTags = `<title>${title}</title>
        <meta name="description" content="${description}" />
        <meta property="og:title" content="${title}" />
        <meta property="og:description" content="${description}" />
        <meta property="og:url" content="${absoluteUrl}" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="${org.nome}" />
        ${imageUrl ? `
        <meta property="og:image" content="${imageUrl}" />
        <meta property="og:image:secure_url" content="${imageUrl}" />` : ''}
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

// Interceptador para rotas de Link na Bio: /links, /bio, /l/:slug e /bio/:slug
router.get(['/links', '/bio', '/l/:slug', '/bio/:slug'], async (req, res, next) => {
  const host = req.headers.host || '';
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const baseUrl = `${protocol}://${host}`;

  const slugParam = req.params.slug;
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
  const isMainDomain = 
    host === 'segundagavetaacademy.com.br' || 
    host === 'www.segundagavetaacademy.com.br' || 
    host === 'segundagaveta.com.br' ||
    host === 'www.segundagaveta.com.br' ||
    host.endsWith('.vercel.app');

  let projectSlug = slugParam || '';
  if (!projectSlug && !isLocalhost && !isMainDomain) {
    const parts = host.split('.');
    if (parts.length > 2) {
      projectSlug = parts[0];
    }
  }

  let html = '';
  try {
    const response = await fetch(`${baseUrl}/index.html`);
    if (response.ok) {
      html = await response.text();
    } else {
      throw new Error('Falha ao buscar index.html');
    }
  } catch (e) {
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

      if (org) {
        const bioConfig = org.config_json?.bio_links_config || {};
        const websiteConfig = org.config_json?.website_config || {};
        const seoConfig = bioConfig.seo || {};
        const pixelsConfig = bioConfig.pixels || {};

        const title = (seoConfig.title || bioConfig.titulo || websiteConfig.specialist_name || org.nome || 'Links Oficiais').replace(/"/g, '&quot;');
        const subtitle = bioConfig.subtitulo || websiteConfig.specialist_bio || `Especialista — links oficiais, cursos e conteúdos de ${title}`;
        const description = (seoConfig.description || subtitle).substring(0, 200).replace(/"/g, '&quot;');

        // Image: priority cascade — SEO override > avatar > website hero > website foto > logo
        let imageUrl = seoConfig.og_image_url
          || bioConfig.avatar_url
          || (websiteConfig.hero_images && websiteConfig.hero_images[0])
          || websiteConfig.specialist_foto_url
          || org.logo_url
          || '';

        // If still no image, try to get specialist photo from courses
        if (!imageUrl && org.id) {
          const { data: coursesData } = await supabase
            .from('cursos')
            .select('professor_foto_url, capa_url, thumbnail_url')
            .eq('organizacao_id', org.id)
            .not('professor_foto_url', 'is', null)
            .limit(1);
          if (coursesData && coursesData.length > 0) {
            imageUrl = coursesData[0].professor_foto_url || coursesData[0].capa_url || coursesData[0].thumbnail_url || '';
          }
        }

        if (imageUrl && !imageUrl.startsWith('http')) {
          imageUrl = `${baseUrl}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
        }

        const absoluteUrl = `${protocol}://${host}${req.originalUrl || req.url}`;

        // Build Pixel scripts to inject in <head>
        let pixelScripts = '';
        if (pixelsConfig.meta_pixel_id) {
          const fbId = pixelsConfig.meta_pixel_id.trim();
          pixelScripts += `
          <!-- Meta Pixel Code -->
          <script>
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${fbId}');
          fbq('track', 'PageView');
          </script>`;
        }

        if (pixelsConfig.google_analytics_id) {
          const gaId = pixelsConfig.google_analytics_id.trim();
          pixelScripts += `
          <!-- Google Analytics -->
          <script async src="https://www.googletagmanager.com/gtag/js?id=${gaId}"></script>
          <script>
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${gaId}');
          </script>`;
        }

        if (pixelsConfig.tiktok_pixel_id) {
          const ttId = pixelsConfig.tiktok_pixel_id.trim();
          pixelScripts += `
          <!-- TikTok Pixel Code -->
          <script>
          !function (w, d, t) {
            w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","addUserData"],ttq.setAndVerify=function(t,e){for(var n=0;n<ttq.methods.length;n++)ttq[t][ttq.methods[n]]=ttq[e](ttq.methods[n]);return ttq};ttq.instance=function(t){for(var e=ttq.methods,n=0;n<e.length;n++)t[e[n]]=ttq[t](e[n]);return t};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
            ttq.load('${ttId}');
            ttq.page();
          }(window, document, 'ttq');
          </script>`;
        }

        const ogTags = `<title>${title}</title>
        <meta charset="UTF-8" />
        <meta name="description" content="${description}" />
        <meta property="og:title" content="${title}" />
        <meta property="og:description" content="${description}" />
        <meta property="og:url" content="${absoluteUrl}" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="${org.nome}" />
        <meta property="og:locale" content="pt_BR" />
        ${imageUrl ? `
        <meta property="og:image" content="${imageUrl}" />
        <meta property="og:image:secure_url" content="${imageUrl}" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="${title}" />` : ''}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="${title}" />
        <meta name="twitter:description" content="${description}" />
        ${imageUrl ? `<meta name="twitter:image" content="${imageUrl}" />
        <meta name="twitter:image:alt" content="${title}" />` : ''}
        ${pixelScripts}`;

        html = html.replace(/<title>[^<]*<\/title>/, ogTags);
        return res.send(html);
      }
    } catch (err) {
      console.error('Erro ao injetar OG bio links:', err);
    }
  }
  return res.send(html);
});

export default router;
