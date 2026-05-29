/**
 * useCourseData — Hook de dados para CursosAdmin
 *
 * Extrai toda a lógica de busca e persistência de dados do mega-componente
 * CursosAdmin.tsx, reduzindo-o de 5000+ linhas para ~3000.
 *
 * Responsabilidades:
 *   - Carregar lista de cursos e trilhas
 *   - Carregar questões disponíveis
 *   - Carregar estatísticas de participantes de um curso
 *   - Salvar currículo, landing page e configuração de splits
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface CourseStats {
  total: number;
  andamento: number;
  concluido: number;
  taxa: number;
}

interface UseCourseDataOptions {
  orgId?: string;
  courseId?: string | null;
}

export function useCourseData({ orgId, courseId }: UseCourseDataOptions) {
  const [cursos, setCursos] = useState<any[]>([]);
  const [trilhas, setTrilhas] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [courseStats, setCourseStats] = useState<CourseStats>({ total: 0, andamento: 0, concluido: 0, taxa: 0 });
  const [courseParticipants, setCourseParticipants] = useState<any[]>([]);
  const [availableQuestions, setAvailableQuestions] = useState<any[]>([]);
  const [participantCounts, setParticipantCounts] = useState<Record<string, number>>({});

  // ─── fetchCursos ──────────────────────────────────────────────────────────

  const fetchCursos = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    setFetchError(null);

    try {
      const { data: cursosData, error: cursosError } = await supabase
        .from('cursos')
        .select('*')
        .eq('organizacao_id', orgId)
        .order('created_at', { ascending: false });

      if (cursosError) {
        setFetchError(`Erro ao carregar cursos: ${cursosError.message}`);
        return;
      }

      const { data: trilhasData } = await supabase
        .from('trilhas')
        .select('*')
        .eq('organizacao_id', orgId)
        .order('created_at', { ascending: false });

      setCursos(cursosData || []);
      setTrilhas(trilhasData || []);

      // Load participant counts for all courses
      if (cursosData && cursosData.length > 0) {
        const counts: Record<string, number> = {};
        await Promise.all(
          cursosData.map(async (curso: any) => {
            const { count } = await supabase
              .from('curso_participantes')
              .select('*', { count: 'exact', head: true })
              .eq('curso_id', curso.id);
            counts[curso.id] = count || 0;
          })
        );
        setParticipantCounts(counts);
      }
    } catch (err: any) {
      setFetchError(`Erro inesperado: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  // ─── fetchQuestoes ────────────────────────────────────────────────────────

  const fetchQuestoes = useCallback(async () => {
    try {
      let query = supabase.from('questoes_teoricas').select('*');
      if (orgId) {
        query = query.eq('organizacao_id', orgId);
      }
      let { data, error } = await query;

      // Fallback if organizacao_id column doesn't exist
      if (error && (error.code === '42703' || error.message?.includes('organizacao_id'))) {
        const result = await supabase.from('questoes_teoricas').select('*');
        data = result.data;
        error = result.error;
      }

      if (!error) {
        setAvailableQuestions(data || []);
      } else {
        console.warn('Error fetching questoes:', error);
      }
    } catch (err) {
      console.error('Unexpected error fetching questoes:', err);
    }
  }, [orgId]);

  // ─── fetchCourseStats ─────────────────────────────────────────────────────

  const fetchCourseStats = useCallback(async (cursoId: string) => {
    try {
      const { data, error } = await supabase
        .from('curso_participantes')
        .select('*, usuarios(nome, email)')
        .eq('curso_id', cursoId);

      if (error) {
        // Log only to console — do not expose DB schema to the UI
        console.error('[DB] Error loading course stats:', error);
        return;
      }

      const total = data?.length || 0;
      const concluido = data?.filter((d: any) => d.status === 'concluido').length || 0;
      const andamento = data?.filter((d: any) => d.status === 'andamento').length || 0;
      const taxa = total > 0 ? Math.round((concluido / total) * 100) : 0;

      setCourseStats({ total, andamento, concluido, taxa });
      setCourseParticipants(data || []);
    } catch (err) {
      console.error('Unexpected error fetching course stats:', err);
    }
  }, []);

  // ─── fetchCourseDetail ────────────────────────────────────────────────────

  const fetchCourseDetail = useCallback(async (cursoId: string) => {
    const { data: freshCurso, error: fetchErr } = await supabase
      .from('cursos')
      .select('*')
      .eq('id', cursoId)
      .single();

    if (fetchErr || !freshCurso) {
      console.error('Error fetching fresh course data:', fetchErr);
      return null;
    }

    // Normalize sections — ensure every section and step has a unique ID
    const rawSections = freshCurso.curriculo_json || [];
    const normalizedSections = rawSections.map((s: any, sIdx: number) => {
      const sectionId = s.id || `sec-${Date.now()}-${sIdx}`;
      return {
        ...s,
        id: sectionId,
        etapas: (s.etapas || []).map((e: any, eIdx: number) => ({
          ...e,
          id: e.id || `step-${Date.now()}-${sIdx}-${eIdx}`
        }))
      };
    });

    setSections(normalizedSections);
    setCursos(prev => prev.map(c => c.id === cursoId ? { ...c, ...freshCurso } : c));

    return freshCurso;
  }, []);

  // ─── saveCurriculo ────────────────────────────────────────────────────────

  const saveCurriculo = useCallback(async (cursoId: string, newSections: any[]): Promise<boolean> => {
    const payloadSize = JSON.stringify(newSections).length;
    const sizeInMB = payloadSize / 1024 / 1024;

    if (sizeInMB > 8) {
      return false; // caller should show toast
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('cursos')
        .update({ curriculo_json: newSections })
        .eq('id', cursoId);

      if (error) throw error;

      setCursos(prev => prev.map(c => c.id === cursoId ? { ...c, curriculo_json: newSections } : c));
      return true;
    } catch (err: any) {
      console.error('Failed to save curriculum:', err);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  // ─── saveLandingPage ──────────────────────────────────────────────────────

  const saveLandingPage = useCallback(async (cursoId: string, lpData: any, currentConfig: any): Promise<boolean> => {
    setIsSaving(true);
    try {
      const newConfig = { ...currentConfig, lp: lpData };
      const { error } = await supabase
        .from('cursos')
        .update({ configuracao_json: newConfig })
        .eq('id', cursoId);

      if (error) throw error;

      setCursos(prev => prev.map(c => c.id === cursoId ? { ...c, configuracao_json: newConfig } : c));
      return true;
    } catch (err: any) {
      console.error('Error saving landing page:', err);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  // ─── saveCourseSplits ─────────────────────────────────────────────────────

  const saveCourseSplits = useCallback(async (
    cursoId: string,
    newSplits: { usuario_id: string; porcentagem: number }[],
    affiliateComm: number,
    currentConfig: any
  ): Promise<boolean> => {
    setIsSaving(true);
    try {
      const newConfig = { ...currentConfig, splits: newSplits, comissao_afiliado: affiliateComm };
      const { error } = await supabase
        .from('cursos')
        .update({ configuracao_json: newConfig })
        .eq('id', cursoId);

      if (error) throw error;

      setCursos(prev => prev.map(c => c.id === cursoId ? { ...c, configuracao_json: newConfig } : c));
      return true;
    } catch (err: any) {
      console.error('Error saving splits:', err);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  // ─── Initial load ─────────────────────────────────────────────────────────

  useEffect(() => {
    fetchCursos();
    fetchQuestoes();
  }, [fetchCursos, fetchQuestoes]);

  return {
    // State
    cursos,
    setCursos,
    trilhas,
    setTrilhas,
    sections,
    setSections,
    isLoading,
    isSaving,
    fetchError,
    courseStats,
    courseParticipants,
    availableQuestions,
    setAvailableQuestions,
    participantCounts,

    // Actions
    fetchCursos,
    fetchQuestoes,
    fetchCourseStats,
    fetchCourseDetail,
    saveCurriculo,
    saveLandingPage,
    saveCourseSplits
  };
}
