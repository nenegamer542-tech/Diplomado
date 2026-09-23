'use strict';

const ApiError = require('../../utils/ApiError');
const { nextSequence, formatCode } = require('../../common/sequence');
const bomRepository = require('./bom.repository');
const productRepository = require('../products/product.repository');

/**
 * Servicio de LISTAS DE MATERIALES / BOM (FASE 6) — multiempresa estricto.
 *
 * Reglas (ADR-012/013):
 *  - companyId SALE SIEMPRE del token; ID ajeno => 404 (nunca 403).
 *  - Sin DELETE: la baja es status inactive. Una BOM inactiva no admite
 *    nuevas órdenes de producción.
 *  - Producto terminado y componentes deben existir y estar activos; el
 *    producto terminado no puede repetirse como componente.
 *  - `code` secuencial POR empresa (BOM-000001…, contador atómico ADR-009).
 */
const CODE_KEY = 'boms';
const CODE_PREFIX = 'BOM';

async function loadActiveProduct(productId, companyId) {
  const product = await productRepository.findById(productId, { companyId });
  if (!product) throw ApiError.notFound('Recurso no encontrado.');
  if (product.status !== 'active') {
    throw ApiError.conflict('El producto está inactivo; no admite movimientos de inventario.');
  }
  return product;
}

/** Valida producto final + componentes (activos, sin duplicados ni autoreferencia). */
async function prepare(productId, components, companyId) {
  await loadActiveProduct(productId, companyId);

  const seen = new Set();
  for (const component of components) {
    if (String(component.productId) === String(productId)) {
      throw ApiError.unprocessable('El componente debe ser distinto del producto terminado.');
    }
    if (seen.has(String(component.productId))) {
      throw ApiError.unprocessable('La lista contiene componentes repetidos.');
    }
    seen.add(String(component.productId));
    await loadActiveProduct(component.productId, companyId);
  }
}

const bomService = {
  async list(filter, options) {
    return bomRepository.find(filter, options);
  },

  async getById(id, companyId) {
    return bomRepository.findById(id, { companyId });
  },

  async create(data, companyId, userId) {
    await prepare(data.productId, data.components, companyId);
    const seq = await nextSequence(companyId, CODE_KEY);

    return bomRepository.create({
      companyId,
      code: formatCode(CODE_PREFIX, seq),
      productId: data.productId,
      components: data.components,
      notes: data.notes || null,
      status: data.status || 'active',
      createdBy: userId || null,
    });
  },

  async update(id, data, companyId) {
    const bom = await bomRepository.findById(id, { companyId });
    if (!bom) throw ApiError.notFound('Recurso no encontrado.');

    // Revalida con los valores FINALES (merge del patch sobre el documento).
    if (data.productId !== undefined || data.components !== undefined) {
      await prepare(
        data.productId !== undefined ? data.productId : bom.productId,
        data.components !== undefined ? data.components : bom.components,
        companyId
      );
    }

    const patch = {};
    for (const field of ['productId', 'components', 'notes', 'status']) {
      if (data[field] !== undefined) patch[field] = data[field];
    }

    return bomRepository.updateById(id, patch, { companyId });
  },
};

module.exports = bomService;
