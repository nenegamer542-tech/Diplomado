'use strict';

const BaseRepository = require('../../common/BaseRepository');
const FinanceAccount = require('./account.model');

/**
 * Repositorio de cuentas financieras — tenant: companyId obligatorio.
 *
 * `updateBalance` es el ÚNICO punto que escribe `balance`: actualiza sólo si
 * el saldo sigue siendo el leído (optimista, igual que ADR-008) y SIEMPRE
 * filtrando por companyId.
 */
class AccountRepository extends BaseRepository {
  constructor() {
    super(FinanceAccount, { requireTenant: true });
  }

  async findByCode(companyId, code) {
    this._guard({ companyId });
    return this.model.findOne({ companyId, code }).lean();
  }

  /** Escritura condicionada del saldo: null => el saldo cambió (carrera). */
  async updateBalance(companyId, accountId, expectedBalance, newBalance) {
    this._guard({ companyId });
    return this.model
      .findOneAndUpdate(
        { _id: accountId, companyId, balance: expectedBalance },
        { $set: { balance: newBalance } },
        { new: true, runValidators: true }
      )
      .lean();
  }
}

module.exports = new AccountRepository();
