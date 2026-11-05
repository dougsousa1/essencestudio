// Review window published as a private Claude artifact: the project lives in the
// artifact's database (doc "projeto/atual"), Claude reads and writes it there,
// and the "Enviar para o Claude" buttons add docs to the "pedidos" collection.
import { useEffect, useRef, useState } from 'react';
import { initialProject } from '../../core/presets';
import { useStudio } from '../../core/store';
import type { Project } from '../../core/types';
import type { SyncState } from './useProjectSync';

type Snap = { exists: boolean; data(): Record<string, unknown> | undefined };
type DocRef = {
  set(d: Record<string, unknown>): Promise<void>;
  update(d: Record<string, unknown>): Promise<void>;
  onSnapshot(next: (s: Snap) => void, err?: (e: { code: string; message: string }) => void): () => void;
};
type Db = { doc(path: string): DocRef; collection(path: string): { doc(id?: string): DocRef } };
type ClaudeWindow = { claude?: { use(name: string): Promise<unknown> } };

export const inArtifact = () => typeof window !== 'undefined' && !!(window as unknown as ClaudeWindow).claude?.use;

const merge = (p: Partial<Project>): Project => {
  const b = initialProject();
  return {
    ...b,
    ...p,
    style: { ...b.style, ...p.style, colors: { ...b.style.colors, ...p.style?.colors }, grade: { ...b.style.grade, ...p.style?.grade } },
    title: { ...b.title, ...p.title },
    sound: { ...b.sound, ...p.sound },
    cut: { ...b.cut, ...p.cut },
  } as Project;
};

export const useArtifactSync = () => {
  const [state, setState] = useState<SyncState & { rascunhoUrl: string; finalUrl: string; capaUrl: string }>({
    ready: false,
    error: null,
    rascunho: 0,
    final: 0,
    pedidoPendente: false,
    status: '',
    rascunhoUrl: '',
    finalUrl: '',
    capaUrl: '',
  });
  const db = useRef<Db | null>(null);
  const lastJson = useRef('');
  const applying = useRef(false);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    const timer = setTimeout(() => setState((s) => (s.ready ? s : { ...s, error: 'Não consegui abrir o projeto. Recarregue a página.' })), 12000);
    (window as unknown as ClaudeWindow).claude!
      .use('db')
      .then((d) => {
        if (!d) {
          clearTimeout(timer);
          setState((s) => ({ ...s, error: 'Entre na sua conta do Claude para abrir o projeto.' }));
          return;
        }
        db.current = d as Db;
        unsub = db.current.doc('projeto/atual').onSnapshot(
          (snap) => {
            clearTimeout(timer);
            const data = snap.data() as
              | { project?: Partial<Project>; status?: string; rascunhoUrl?: string; finalUrl?: string; capaUrl?: string; pedidoPendente?: boolean; versao?: number }
              | undefined;
            if (!data?.project) {
              setState((s) => ({ ...s, error: 'O Claude ainda está preparando o projeto…' }));
              return;
            }
            const json = JSON.stringify(data.project);
            if (json !== lastJson.current) {
              lastJson.current = json;
              applying.current = true;
              useStudio.getState().setProject(merge({ ...data.project, assetBase: undefined }));
              applying.current = false;
            }
            setState((s) => ({
              ...s,
              ready: true,
              error: null,
              status: data.status ?? '',
              pedidoPendente: !!data.pedidoPendente,
              rascunhoUrl: data.rascunhoUrl ?? '',
              finalUrl: data.finalUrl ?? '',
              capaUrl: data.capaUrl ?? '',
              rascunho: data.rascunhoUrl ? data.versao ?? 1 : 0,
              final: data.finalUrl ? 1 : 0,
            }));
          },
          (e) => setState((s) => ({ ...s, error: e.message })),
        );
      });
    return () => {
      clearTimeout(timer);
      unsub?.();
    };
  }, []);

  // Save the person's choices back to the database (debounced).
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const unsub = useStudio.subscribe((s, prev) => {
      if (applying.current || s.project === prev.project || !db.current) return;
      clearTimeout(t);
      t = setTimeout(() => {
        const json = JSON.stringify(s.project);
        if (json === lastJson.current) return;
        lastJson.current = json;
        void db.current!.doc('projeto/atual').update({ project: s.project });
      }, 700);
    });
    return () => {
      clearTimeout(t);
      unsub();
    };
  }, []);

  const send = async (pedido: Record<string, unknown>) => {
    if (!db.current) return;
    const id = `p${Date.now()}`;
    await db.current.collection('pedidos').doc(id).set({ ...pedido, enviadoEm: new Date().toISOString(), visto: false });
    await db.current.doc('projeto/atual').update({ pedidoPendente: true, status: 'Enviado. Aguardando o Claude…' });
  };

  const outputUrl = (f: string) => (f === 'reel.mp4' ? state.finalUrl : f === 'capa.jpg' ? state.capaUrl : state.rascunhoUrl);
  return { ...state, send, outputUrl: (f: string, _v: number) => outputUrl(f) };
};
