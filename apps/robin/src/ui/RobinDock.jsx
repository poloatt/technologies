import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Box, Typography } from '@mui/material';
import clienteAxios from '@shared/config/axios';
import { FOOTER_CONFIG } from '@shared/config/uiConstants';
import { useScopedActionHistory, useUndoScope } from '@shared/hooks/useScopedUndo';
import { originLabel, originTitle } from '../origin.js';
import { FONT_SIZE } from '@shared/tipografia';

const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp,image/gif,text/plain,text/csv,application/json';

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      nombre: file.name,
      mime: file.type || 'application/octet-stream',
      data: String(reader.result || ''),
    });
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

export function RecordOrigin({ origen, sx }) {
  const label = originLabel(origen);
  const title = originTitle(origen);
  return (
    <Typography
      component="span"
      variant="caption"
      title={title}
      aria-label={title}
      sx={{
        ml: 0.75,
        color: 'text.secondary',
        fontSize: FONT_SIZE.xs,
        letterSpacing: 0.2,
        ...sx,
      }}
    >
      {label}
    </Typography>
  );
}

export function RobinDock({ surface = 'data', context = null }) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState([]);
  const [model, setModel] = useState('');
  const [draft, setDraft] = useState('');
  const [files, setFiles] = useState([]);
  const [turns, setTurns] = useState([]);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const threadRef = useRef(null);
  const fileRef = useRef(null);
  const scope = useUndoScope();
  const { addScopedAction } = useScopedActionHistory(scope);
  const contextRef = useRef(context);
  contextRef.current = context;
  const busyRef = useRef(false);

  useEffect(() => {
    clienteAxios.get('/api/robin/models')
      .then((response) => {
        setModels(response.data?.models || []);
        setModel(response.data?.selected || '');
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const node = threadRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [turns, open]);

  const sendTurn = async ({ text, pendingFiles = [] }) => {
    const content = String(text || '').trim() || (pendingFiles.length ? 'Catalogá estos archivos.' : '');
    if (!content || busyRef.current) return;
    const history = turns.flatMap((turn) => ([
      { role: 'user', content: turn.user },
      turn.reply ? { role: 'assistant', content: turn.reply } : null,
    ].filter(Boolean)));
    busyRef.current = true;
    setDraft('');
    setFiles([]);
    setBusy(true);
    setOpen(true);
    setTurns((current) => [...current, { user: content, reply: '', changes: [], pending: true }]);
    try {
      const response = await clienteAxios.post('/api/robin/chat', {
        surface,
        model,
        context: contextRef.current,
        messages: [...history, { role: 'user', content }],
        files: pendingFiles,
      });
      const reply = response.data?.reply || '';
      const changes = response.data?.changes || [];
      const domains = response.data?.domains || [];
      const undos = response.data?.undos || [];
      undos.forEach((action) => {
        addScopedAction({
          type: action.type,
          entity: action.entity,
          entityId: action.entityId,
          data: action.data,
          originalData: action.originalData ?? null,
          description: action.description,
          scope,
        });
      });
      setTurns((current) => current.map((turn, index) => (
        index === current.length - 1
          ? { user: content, reply, changes, pending: false }
          : turn
      )));
      if (domains.length) {
        window.dispatchEvent(new CustomEvent('robin-changed', { detail: { domains } }));
      }
    } catch (error) {
      const message = error?.response?.data?.error || 'Robin no pudo responder.';
      setTurns((current) => current.map((turn, index) => (
        index === current.length - 1
          ? { user: content, reply: message, changes: [], pending: false }
          : turn
      )));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const sendTurnRef = useRef(sendTurn);
  sendTurnRef.current = sendTurn;

  const addFiles = async (list, { send = false } = {}) => {
    const accepted = Array.from(list || []).slice(0, 4);
    const tooBig = accepted.filter((file) => file.size > 4 * 1024 * 1024);
    const next = [];
    for (const file of accepted.filter((item) => item.size <= 4 * 1024 * 1024)) {
      next.push(await readFile(file));
    }
    if (tooBig.length) {
      setOpen(true);
      setTurns((current) => [...current, {
        user: tooBig.map((file) => file.name).join(', '),
        reply: 'El archivo supera 4 MB.',
        changes: [],
        pending: false,
      }]);
    }
    if (!next.length) return;
    if (send) {
      const foco = contextRef.current;
      const askingMeal = surface === 'nutricion';
      const text = askingMeal
        ? (foco?.comidaId
          ? 'Completá la comida seleccionada con este archivo.'
          : 'Armá la comida con este archivo.')
        : 'Catalogá estos archivos en la parte del cuerpo que correspondan y completá los datos que se lean.';
      await sendTurnRef.current({ text, pendingFiles: next });
      return;
    }
    setFiles((current) => [...current, ...next].slice(0, 4));
    setOpen(true);
  };

  const addFilesRef = useRef(addFiles);
  addFilesRef.current = addFiles;

  useEffect(() => {
    const onFiles = (event) => {
      if (event.detail?.surface !== surface) return;
      addFilesRef.current(event.detail.files, { send: true }).catch(() => {});
    };
    window.addEventListener('robin-files', onFiles);
    return () => window.removeEventListener('robin-files', onFiles);
  }, [surface]);

  const send = () => sendTurn({ text: draft, pendingFiles: files });

  const panel = (
    <Box
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setDragOver(false);
        addFiles(event.dataTransfer.files).catch(() => {});
      }}
      sx={{
        position: 'fixed',
        right: 16,
        bottom: `${FOOTER_CONFIG.height + 12}px`,
        zIndex: FOOTER_CONFIG.zIndex + 50,
        width: open ? 320 : 'auto',
      }}
    >
      {open ? (
        <Box
          sx={{
            mb: 1,
            border: '1px solid',
            borderColor: dragOver ? 'text.primary' : 'divider',
            bgcolor: 'background.paper',
            display: 'flex',
            flexDirection: 'column',
            height: 420,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="body2" sx={{ flex: 1 }}>Robin</Typography>
            <Box
              component="select"
              aria-label="Modelo de Robin"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              sx={{
                border: 0,
                bgcolor: 'transparent',
                color: 'text.secondary',
                font: 'inherit',
                fontSize: FONT_SIZE.sm,
              }}
            >
              {models.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </Box>
            <Box
              component="button"
              type="button"
              aria-label="Cerrar Robin"
              onClick={() => setOpen(false)}
              sx={{ border: 0, bgcolor: 'transparent', color: 'text.secondary', cursor: 'pointer', font: 'inherit' }}
            >
              Cerrar
            </Box>
          </Box>
          <Box ref={threadRef} sx={{ flex: 1, overflow: 'auto', px: 1.25, py: 1 }}>
            {turns.length === 0 ? (
              <Typography variant="caption" color="text.secondary">
                {surface === 'nutricion'
                  ? (context?.comidaNombre
                    ? `Sobre ${context.comidaNombre}.`
                    : 'Contame una comida y la dejo armada.')
                  : (context?.zona
                    ? `Foco en ${context.parte || context.zona}. Soltá un archivo.`
                    : 'Preguntame por tus datos o soltá un archivo.')}
              </Typography>
            ) : turns.map((turn, index) => (
              <Box key={`${turn.user}-${index}`} sx={{ mb: 1.25 }}>
                <Typography variant="body2">{turn.user}</Typography>
                {turn.pending ? (
                  <Typography variant="caption" color="text.secondary">…</Typography>
                ) : (
                  <>
                    {turn.reply ? (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{turn.reply}</Typography>
                    ) : null}
                    {turn.changes?.map((change) => (
                      <Typography key={change} variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {change}
                      </Typography>
                    ))}
                  </>
                )}
              </Box>
            ))}
          </Box>
          {files.length > 0 ? (
            <Typography variant="caption" color="text.secondary" sx={{ px: 1.25 }}>
              {files.map((file) => file.nombre).join(' · ')}
            </Typography>
          ) : null}
          <Box sx={{ display: 'flex', gap: 1, px: 1.25, py: 1, borderTop: '1px solid', borderColor: 'divider' }}>
            <Box
              component="button"
              type="button"
              aria-label="Adjuntar archivo"
              onClick={() => fileRef.current?.click()}
              sx={{ border: 0, bgcolor: 'transparent', color: 'text.secondary', cursor: 'pointer', font: 'inherit', fontSize: FONT_SIZE.sm }}
            >
              Archivo
            </Box>
            <Box
              component="input"
              value={draft}
              placeholder="Escribí"
              aria-label="Mensaje para Robin"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              sx={{
                flex: 1,
                border: 0,
                outline: 0,
                bgcolor: 'transparent',
                color: 'text.primary',
                font: 'inherit',
                fontSize: FONT_SIZE.base,
              }}
            />
            <Box
              component="button"
              type="button"
              onClick={send}
              disabled={busy || (!draft.trim() && files.length === 0)}
              sx={{ border: 0, bgcolor: 'transparent', color: 'text.primary', cursor: 'pointer', font: 'inherit', fontSize: FONT_SIZE.sm }}
            >
              Enviar
            </Box>
          </Box>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            multiple
            hidden
            onChange={(event) => {
              addFiles(event.target.files).catch(() => {});
              event.target.value = '';
            }}
          />
        </Box>
      ) : null}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Box
          component="button"
          type="button"
          aria-label={open ? 'Robin abierto' : 'Abrir Robin'}
          onClick={() => setOpen((value) => !value)}
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            color: 'text.primary',
            cursor: 'pointer',
            font: 'inherit',
            fontSize: FONT_SIZE.md,
            px: 1.25,
            py: 0.5,
          }}
        >
          Robin
        </Box>
      </Box>
    </Box>
  );

  return createPortal(panel, document.body);
}
