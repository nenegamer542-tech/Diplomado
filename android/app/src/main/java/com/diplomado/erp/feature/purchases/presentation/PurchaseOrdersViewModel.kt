package com.diplomado.erp.feature.purchases.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.diplomado.erp.core.network.client.RetrofitClient
import com.diplomado.erp.core.network.dto.PurchaseOrderDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class PurchaseOrdersUiState {
    data object Loading : PurchaseOrdersUiState()
    data class Success(val orders: List<PurchaseOrderDto>) : PurchaseOrdersUiState()
    data class Error(val message: String) : PurchaseOrdersUiState()
}

class PurchaseOrdersViewModel : ViewModel() {

    private val _uiState = MutableStateFlow<PurchaseOrdersUiState>(PurchaseOrdersUiState.Loading)
    val uiState: StateFlow<PurchaseOrdersUiState> = _uiState.asStateFlow()

    init {
        loadOrders()
    }

    fun loadOrders(status: String? = null) {
        viewModelScope.launch {
            _uiState.value = PurchaseOrdersUiState.Loading
            try {
                val res = RetrofitClient.api.getPurchaseOrders(status = status)
                if (res.isSuccessful && res.body()?.data != null) {
                    _uiState.value = PurchaseOrdersUiState.Success(res.body()!!.data!!)
                } else {
                    _uiState.value = PurchaseOrdersUiState.Error(res.body()?.error?.message ?: "Error al cargar órdenes de compra.")
                }
            } catch (e: Exception) {
                _uiState.value = PurchaseOrdersUiState.Error(e.message ?: "Error de red.")
            }
        }
    }

    fun createOrder(notes: String, onComplete: (Boolean, String?) -> Unit) {
        viewModelScope.launch {
            try {
                val body = mapOf(
                    "notes" to notes.ifEmpty { "Solicitud de Insumos de Obra" },
                    "lines" to emptyList<Any>()
                )
                val res = RetrofitClient.api.createPurchaseOrder(body)
                if (res.isSuccessful) {
                    loadOrders()
                    onComplete(true, null)
                } else {
                    onComplete(false, res.body()?.error?.message ?: "Error al registrar la compra.")
                }
            } catch (e: Exception) {
                onComplete(false, e.message ?: "Error de conexión.")
            }
        }
    }

    fun approveOrder(id: String) {
        viewModelScope.launch {
            try {
                val res = RetrofitClient.api.approvePurchaseOrder(id)
                if (res.isSuccessful) {
                    loadOrders()
                } else {
                    _uiState.value = PurchaseOrdersUiState.Error(res.body()?.error?.message ?: "No se pudo aprobar la orden.")
                }
            } catch (e: Exception) {
                _uiState.value = PurchaseOrdersUiState.Error(e.message ?: "Error de conexión.")
            }
        }
    }

    fun rejectOrder(id: String, reason: String) {
        viewModelScope.launch {
            try {
                val res = RetrofitClient.api.rejectPurchaseOrder(id, mapOf("reason" to reason))
                if (res.isSuccessful) {
                    loadOrders()
                } else {
                    _uiState.value = PurchaseOrdersUiState.Error(res.body()?.error?.message ?: "No se pudo rechazar la orden.")
                }
            } catch (e: Exception) {
                _uiState.value = PurchaseOrdersUiState.Error(e.message ?: "Error de conexión.")
            }
        }
    }
}
