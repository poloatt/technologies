import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRobinModel, DEFAULT_ROBIN_MODEL } from '../models.js';
import { toAnthropicMessages } from '../messages.js';
import { runRobinTurn } from '../runTurn.js';
import { originLabel } from '../../origin.js';
import { toGeminiContents } from '../gemini.js';

test('el foco de pantalla entra en el pedido sin texto extra', () => {
  const hint = focusHint({
    zona: 'sangre',
    parte: 'higado',
    capa: 'organos',
    comidaId: 'abc',
    comidaNombre: 'Avena',
  });
  assert.match(hint, /zona sangre/);
  assert.match(hint, /id abc/);
  assert.equal(focusHint(null), '');
});

test('un modelo desconocido cae en Gemini, la opción gratis por defecto', () => {
  assert.equal(resolveRobinModel('gpt-4').id, DEFAULT_ROBIN_MODEL);
  assert.equal(resolveRobinModel('gpt-4').free, true);
  assert.equal(resolveRobinModel('claude-haiku-4-5-20251001').provider, 'anthropic');
  assert.equal(resolveRobinModel(null).provider, 'gemini');
});

test('un llamado a herramienta de Gemini vuelve como functionCall', () => {
  const contents = toGeminiContents([
    { role: 'assistant', content: [{ type: 'tool_use', id: 'gem_1', name: 'guardar_comida', input: { nombre: 'Avena' } }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'gem_1', content: '{"ok":true}' }] },
  ]);
  assert.equal(contents[0].role, 'model');
  assert.equal(contents[0].parts[0].functionCall.name, 'guardar_comida');
  assert.equal(contents[1].parts[0].functionResponse.name, 'guardar_comida');
  assert.equal(contents[1].parts[0].functionResponse.response.ok, true);
});

test('un PDF del último mensaje entra como documento', () => {
  const messages = toAnthropicMessages(
    [{ role: 'user', content: 'catalogá esto' }],
    [{ nombre: 'lab.pdf', mime: 'application/pdf', data: Buffer.from('pdf').toString('base64') }],
  );
  const content = messages[0].content;
  assert.equal(content[0].type, 'document');
  assert.equal(content[0].source.media_type, 'application/pdf');
  assert.equal(content[1].text, 'catalogá esto');
});

test('el turno guarda, acumula el cambio y cierra con texto', async () => {
  const calls = [];
  const result = await runRobinTurn({
    system: 'test',
    tools: [],
    messages: [{ role: 'user', content: 'anotá avena' }],
    complete: async ({ messages }) => {
      calls.push(messages.length);
      if (calls.length === 1) {
        return {
          content: [{
            type: 'tool_use',
            id: 'tool_1',
            name: 'guardar_comida',
            input: { nombre: 'Avena' },
          }],
        };
      }
      return { content: [{ type: 'text', text: 'Quedó anotada.' }] };
    },
    executeTool: async (name, input) => {
      assert.equal(name, 'guardar_comida');
      assert.equal(input.nombre, 'Avena');
      return { change: 'Avena · diaria', domain: 'dieta', undo: { type: 'CREATE', entity: 'receta' }, output: { ok: true } };
    },
  });

  assert.deepEqual(result.changes, ['Avena · diaria']);
  assert.equal(result.undos.length, 1);
  assert.equal(result.undos[0].entity, 'receta');
  assert.deepEqual(result.domains, ['dieta']);
  assert.equal(result.reply, 'Quedó anotada.');
  assert.equal(originLabel('robin'), 'IA');
  assert.equal(originLabel('usuario'), 'Vos');
});
