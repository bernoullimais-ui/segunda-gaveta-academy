/**
 * Utilitários para URLs de vídeo
 * Extraído de CursosAdmin.tsx e CursosCandidato.tsx para eliminar duplicação.
 */

/**
 * Converte qualquer URL do YouTube para o formato embed com parâmetros otimizados.
 * Suporta: youtube.com/watch?v=, youtube.com/live/, youtu.be/, e URLs embed diretas.
 */
export function getFormattedVideoUrl(url: string): string {
  if (!url) return '';
  let formattedUrl = url;

  if (formattedUrl.includes('youtube.com/watch?v=')) {
    formattedUrl = formattedUrl.replace('watch?v=', 'embed/');
  } else if (formattedUrl.includes('youtube.com/live/')) {
    formattedUrl = formattedUrl.replace('youtube.com/live/', 'youtube.com/embed/');
  } else if (formattedUrl.includes('youtu.be/')) {
    formattedUrl = formattedUrl.replace('youtu.be/', 'youtube.com/embed/');
  }

  if (formattedUrl.includes('youtube.com/embed/')) {
    const separator = formattedUrl.includes('?') ? '&' : '?';
    formattedUrl += `${separator}rel=0&modestbranding=1`;
  }

  return formattedUrl;
}
