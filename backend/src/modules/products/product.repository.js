'use strict';

const BaseRepository = require('../../common/BaseRepository');
const Product = require('./product.model');

/** Repositorio de productos — tenant: companyId obligatorio (guardia Base). */
class ProductRepository extends BaseRepository {
  constructor() {
    super(Product, { requireTenant: true });
  }

  async findBySku(companyId, sku) {
    this._guard({ companyId });
    return this.model.findOne({ companyId, sku }).lean();
  }
}

module.exports = new ProductRepository();
