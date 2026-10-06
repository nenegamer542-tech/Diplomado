package com.diplomado.erp.feature.sales.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.diplomado.erp.core.network.client.RetrofitClient
import com.diplomado.erp.core.network.dto.SalesOrderDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class SalesOrdersUiState {
    data object Loading : SalesOrdersUiState()
    data class Success(val orders: List<SalesOrderDto>) : SalesOrdersUiState()
    data class Error(val message: String) : SalesOrdersUiState()
}

class SalesOrdersViewModel : ViewModel() {

    private val _uiState = MutableStateFlow<SalesOrdersUiState>(SalesOrdersUiState.Loading)
    val uiState: StateFlow<SalesOrdersUiState> = _uiState.asStateFlow()

    init {
        loadOrders()
    }

    fun loadOrders(status: String? = null) {
        viewModelScope.launch {
            _uiState.value = SalesOrdersUiState.Loading
            try {
                val res = RetrofitClient.api.getSalesOrders(status = status)
                if (res.isSuccessful && res.body()?.data != null) {
                    _uiState.value = SalesOrdersUiState.Success(res.body()!!.data!!)
                } else {
                    _uiState.value = SalesOrdersUiState.Error(res.body()?.error?.message ?: "Error al cargar estimaciones.")
                }
            } catch (e: Exception) {
                _uiState.value = SalesOrdersUiState.Error(e.message ?: "Error de red.")
            }
        }
    }

    fun createOrder(notes: String, onComplete: (Boolean, String?) -> Unit) {
        viewModelScope.launch {
            try {
                val body = mapOf(
                    "notes" to notes.ifEmpty { "Estimación de avance de obra" },
                    "lines" to emptyList<Any>()
                )
                val res = RetrofitClient.api.createSalesOrder(body)
                if (res.isSuccessful) {
                    loadOrders()
                    onComplete(true, null)
                } else {
                    onComplete(false, res.body()?.error?.message ?: "Error al registrar la estimación.")
                }
            } catch (e: Exception) {
                onComplete(false, e.message ?: "Error de conexión.")
            }
        }
    }

    fun approveOrder(id: String) {
        viewModelScope.launch {
            try {
                val res = RetrofitClient.api.approveSalesOrder(id)
                if (res.isSuccessful) {
                    loadOrders()
                } else {
                    _uiState.value = SalesOrdersUiState.Error(res.body()?.error?.message ?: "No se pudo aprobar la estimación.")
                }
            } catch (e: Exception) {
                _uiState.value = SalesOrdersUiState.Error(e.message ?: "Error de conexión.")
            }
        }
    }
}
