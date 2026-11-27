import { BaseController } from './BaseController.js';
import { TransaccionRecurrente } from '../models/TransaccionRecurrente.js';
import { Transacciones } from '../models/Transacciones.js';
import mongoose from 'mongoose';
import { addMonths, setDate, isBefore, isAfter, getDaysInMonth } from 'date-fns';

class TransaccionRecurrenteController extends BaseController {
  constructor() {
    super(TransaccionRecurrente, {
      searchFields: ['descripcion', 'categoria'],
      populate: ['cuenta', 'propiedad']
    });

    // Bind de los métodos al contexto de la instancia
    this.generarTransacciones = this.generarTransacciones.bind(this);
    this.create = this.create.bind(this);
  }

  // Sobreescribir el método create para manejar la generación inicial
  async create(req, res) {
    try {
      const nuevaTransaccionRecurrente = new this.Model({
        ...req.body,
        usuario: req.user.id,
        proximaGeneracion: new Date(req.body.fechaInicio)
      });

      await nuevaTransaccionRecurrente.save();
      
      // Generar la primera transacción si la fecha de inicio es hoy o anterior
      if (isBefore(new Date(req.body.fechaInicio), new Date()) || 
          new Date(req.body.fechaInicio).toDateString() === new Date().toDateString()) {
        await this.generarTransaccion(nuevaTransaccionRecurrente);
      }

      res.status(201).json(nuevaTransaccionRecurrente);
    } catch (error) {
      console.error('Error al crear transacción recurrente:', error);
      res.status(500).json({ error: 'Error al crear transacción recurrente' });
    }
  }

  // Método para generar transacciones pendientes
  async generarTransacciones(req, res) {
    try {
      const transaccionesRecurrentes = await this.Model.find({
        usuario: req.user.id,
        estado: 'ACTIVO',
        $or: [
          { fechaFin: { $exists: false } },
          { fechaFin: { $gt: new Date() } }
        ]
      });

      let generadas = 0;
      for (const transaccion of transaccionesRecurrentes) {
        if (await this.generarTransaccion(transaccion)) {
          generadas++;
        }
      }

      res.json({ message: `${generadas} transacciones generadas` });
    } catch (error) {
      console.error('Error al generar transacciones:', error);
      res.status(500).json({ error: 'Error al generar transacciones' });
    }
  }

  // Método auxiliar para generar una transacción
  async generarTransaccion(transaccionRecurrente) {
    try {
      const fechaActual = new Date();
      const proximaGeneracion = new Date(transaccionRecurrente.proximaGeneracion);

      if (isAfter(proximaGeneracion, fechaActual)) {
        return false;
      }

      // Crear la nueva transacción
      const nuevaTransaccion = new Transacciones({
        descripcion: transaccionRecurrente.descripcion,
        monto: transaccionRecurrente.monto,
        fecha: proximaGeneracion,
        tipo: transaccionRecurrente.tipo,
        categoria: transaccionRecurrente.categoria,
        cuenta: transaccionRecurrente.cuenta,
        usuario: transaccionRecurrente.usuario,
        estado: 'PENDIENTE',
        // La moneda la asigna el middleware del modelo a partir de la cuenta.
        origen: { tipo: 'MANUAL', metadata: { recurrenteId: String(transaccionRecurrente._id) } }
      });

      await nuevaTransaccion.save();

      // Calcular próxima fecha de generación
      let proximaFecha;
      switch (transaccionRecurrente.frecuencia) {
        case 'MENSUAL':
          proximaFecha = addMonths(proximaGeneracion, 1);
          break;
        case 'TRIMESTRAL':
          proximaFecha = addMonths(proximaGeneracion, 3);
          break;
        case 'SEMESTRAL':
          proximaFecha = addMonths(proximaGeneracion, 6);
          break;
        case 'ANUAL':
          proximaFecha = addMonths(proximaGeneracion, 12);
          break;
      }

      // Frecuencia desconocida: se asume mensual para no dejar la fecha indefinida.
      if (!proximaFecha) proximaFecha = addMonths(proximaGeneracion, 1);

      // Ajustar al día del mes especificado (sin pasarse al mes siguiente: 31 en un mes de 30 días)
      const diaDelMes = Number(transaccionRecurrente.diaDelMes) || proximaFecha.getDate();
      proximaFecha = setDate(proximaFecha, Math.min(diaDelMes, getDaysInMonth(proximaFecha)));

      // Actualizar la transacción recurrente
      transaccionRecurrente.ultimaGeneracion = proximaGeneracion;
      transaccionRecurrente.proximaGeneracion = proximaFecha;
      transaccionRecurrente.transaccionesGeneradas.push(nuevaTransaccion._id);
      await transaccionRecurrente.save();

      return true;
    } catch (error) {
      console.error('Error al generar transacción:', error);
      return false;
    }
  }
}

export const transaccionRecurrenteController = new TransaccionRecurrenteController(); 