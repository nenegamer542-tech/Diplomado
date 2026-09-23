'use strict';

const BaseRepository = require('../../common/BaseRepository');
const Lead = require('./lead.model');

/** Repositorio de leads CRM — tenant: companyId obligatorio (guardia Base). */
class LeadRepository extends BaseRepository {
  constructor() {
    super(Lead, { requireTenant: true });
  }
}

module.exports = new LeadRepository();
