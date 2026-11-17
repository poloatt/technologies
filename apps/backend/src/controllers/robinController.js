import { Users } from '../models/index.js';
import {
  ROBIN_MODELS,
  resolveRobinModel,
  missingCredential,
  PULSO_TOOLS,
  buildSystemPrompt,
  toAnthropicMessages,
  completeRobin,
  runRobinTurn,
} from '../../../robin/src/server/index.js';
import { bodyCatalog, createPulsoExecutor } from '../services/robinPulso.js';

function userId(req) {
  return req.user?._id || req.user?.id;
}

export const robinController = {
  getModels: async (req, res) => {
    try {
      const user = await Users.findById(userId(req)).select('robinModel robinModelChosen').lean();
      const selected = user?.robinModelChosen
        ? resolveRobinModel(user.robinModel)
        : resolveRobinModel(null);
      res.json({
        models: ROBIN_MODELS,
        selected: selected.id,
      });
    } catch (error) {
      console.error('Error al leer modelos de Robin:', error);
      res.status(500).json({ error: 'No se pudieron leer los modelos' });
    }
  },

  chat: async (req, res) => {
    const usuario = userId(req);
    const model = resolveRobinModel(req.body?.model);
    const credentialError = missingCredential(model);
    if (credentialError) {
      return res.status(503).json({ error: credentialError });
    }

    const surface = req.body?.surface === 'nutricion' ? 'nutricion' : 'data';
    const files = Array.isArray(req.body?.files) ? req.body.files.slice(0, 4) : [];

    try {
      await Users.updateOne({ _id: usuario }, {
        $set: { robinModel: model.id, robinModelChosen: true },
      });
      const result = await runRobinTurn({
        system: buildSystemPrompt({
          surface,
          catalog: bodyCatalog(),
          context: req.body?.context,
        }),
        tools: PULSO_TOOLS,
        messages: toAnthropicMessages(req.body?.messages, files),
        complete: (payload) => completeRobin({
          model,
          ...payload,
        }),
        executeTool: createPulsoExecutor({ usuario, files }),
      });
      res.json({ ...result, model: model.id });
    } catch (error) {
      console.error('Error de Robin:', error.message);
      const status = error.status >= 400 && error.status < 600 ? error.status : 500;
      res.status(status).json({ error: error.message || 'Robin no pudo responder.' });
    }
  },
};
