import { useEffect, useRef, useState } from 'react';
import { initialProject } from '../../core/presets';
import { useStudio } from '../../core/store';
import type { Project } from '../../core/types';

export type SyncState = { ready: boolean; error: string | null; rascunho: number; final: number; pedidoPendente: boolean; status: string };

const api = (path: string, dir: string) => `/api/${path}?dir=${encodeURIComponent(dir)}`;

/** Fill missing settings with the studio defaults (Claude may write only part of them). */
const merge = (p: Partial<Project>): Project => {
  const b = initialProject();
  return { ...b, ...p, style: { ...b.style, ...p.style, colors: { ...b.style.colors, ...p.style?.colors }, grade: { ...b.style.grade, ...p.style?.grade } }, title: { ...b.title, ...p.title }, sound: { ...b.sound, ...p.sound }, cut: { ...b.cut, ...p.cut } } as Project;
};

/**
 * Keeps the studio store and <dir>/project.json in sync:
 * loads it, saves every change (debounced) and reloads when Claude edits the file.
 */
export const useProjectSync = (dir: string | null) => {
  const [state, setState] = useState<SyncState>({ ready: false, error: null, rascunho: 0, final: 0, pedidoPendente: false, status: '' });
  const srcUrl = useRef<string>('');
  const mtime = useRef(0);
  const applying = useRef(false);

  const load = async () => {
    if (!dir) return;
    const r = await fetch(api('projeto', dir));
    if (!r.ok) throw new Error('Não encontrei o projeto. Confira a pasta.');
    const { project, mtime: m } = await r.json();
    mtime.current = m;
    srcUrl.current = project.video?.url ?? '';
    applying.current = true;
    useStudio.getState().setProject(merge({ ...project, assetBase: undefined, video: project.video ? { ...project.video, url: api('video', dir) } : null }));
    applying.current = false;
  };

  // First load.
  useEffect(() => {
    if (!dir) return;
    load()
      .then(() => setState((s) => ({ ...s, ready: true })))
      .catch((e) => setState((s) => ({ ...s, error: (e as Error).message })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dir]);

  // Save changes made in the window.
  useEffect(() => {
    if (!dir) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const unsub = useStudio.subscribe((s, prev) => {
      if (applying.current || s.project === prev.project || !s.project.video) return;
      clearTimeout(t);
      t = setTimeout(async () => {
        const p = { ...s.project, video: { ...s.project.video!, url: srcUrl.current } };
        const r = await fetch(api('projeto', dir), { method: 'POST', body: JSON.stringify(p, null, 1) });
        if (r.ok) mtime.current = (await r.json()).mtime;
      }, 500);
    });
    return () => {
      clearTimeout(t);
      unsub();
    };
  }, [dir]);

  // Watch for Claude's edits and new renders.
  useEffect(() => {
    if (!dir) return;
    const id = setInterval(async () => {
      try {
        const e = await (await fetch(api('estado', dir))).json();
        if (e.mtime > mtime.current + 1) await load();
        setState((s) => ({ ...s, rascunho: e.rascunho, final: e.final, pedidoPendente: e.pedidoPendente, status: e.status }));
      } catch {
        /* server restarting: try again */
      }
    }, 1500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dir]);

  const send = async (pedido: Record<string, unknown>) => {
    if (!dir) return;
    await fetch(api('enviar', dir), { method: 'POST', body: JSON.stringify({ ...pedido, enviadoEm: new Date().toISOString() }, null, 1) });
    setState((s) => ({ ...s, pedidoPendente: true, status: 'Enviado. Aguardando o Claude…' }));
  };

  return { ...state, send, outputUrl: (f: string, v: number) => (dir ? `${api('saida', dir)}&f=${f}&v=${v}` : '') };
};
