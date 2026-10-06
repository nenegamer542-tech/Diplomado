package com.diplomado.erp.feature.inventory.stock.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.diplomado.erp.core.network.client.RetrofitClient
import com.diplomado.erp.core.network.dto.StockLevelDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class StockUiState {
    data object Loading : StockUiState()
    data class Success(val stockLevels: List<StockLevelDto>) : StockUiState()
    data class Error(val message: String) : StockUiState()
}

class StockViewModel : ViewModel() {

    private val _uiState = MutableStateFlow<StockUiState>(StockUiState.Loading)
    val uiState: StateFlow<StockUiState> = _uiState.asStateFlow()

    init {
        loadStock()
    }

    fun loadStock(warehouseId: String? = null, productId: String? = null) {
        viewModelScope.launch {
            _uiState.value = StockUiState.Loading
            try {
                val res = RetrofitClient.api.getStock(warehouseId, productId)
                if (res.isSuccessful && res.body()?.data != null) {
                    _uiState.value = StockUiState.Success(res.body()!!.data!!)
                } else {
                    _uiState.value = StockUiState.Error(res.body()?.error?.message ?: "Error al cargar existencias.")
                }
            } catch (e: Exception) {
                _uiState.value = StockUiState.Error(e.message ?: "Error de conexión.")
            }
        }
    }

    fun createAdjustment(productId: String, warehouseId: String, newQuantity: Double, reason: String, onComplete: (Boolean, String?) -> Unit) {
        viewModelScope.launch {
            try {
                val body = mapOf(
                    "productId" to productId,
                    "warehouseId" to warehouseId,
                    "quantity" to newQuantity,
                    "reason" to reason.ifEmpty { "Ajuste físico de inventario de obra" }
                )
                val res = RetrofitClient.api.createAdjustment(body)
                if (res.isSuccessful) {
                    loadStock()
                    onComplete(true, null)
                } else {
                    onComplete(false, res.body()?.error?.message ?: "Error al ajustar el stock.")
                }
            } catch (e: Exception) {
                onComplete(false, e.message ?: "Error de conexión.")
            }
        }
    }
}
