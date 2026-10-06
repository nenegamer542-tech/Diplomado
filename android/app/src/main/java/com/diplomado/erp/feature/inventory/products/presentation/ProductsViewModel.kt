package com.diplomado.erp.feature.inventory.products.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.diplomado.erp.core.network.client.RetrofitClient
import com.diplomado.erp.core.network.dto.ProductDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class ProductsUiState {
    data object Loading : ProductsUiState()
    data class Success(val products: List<ProductDto>, val total: Int) : ProductsUiState()
    data class Error(val message: String) : ProductsUiState()
}

class ProductsViewModel : ViewModel() {

    private val _uiState = MutableStateFlow<ProductsUiState>(ProductsUiState.Loading)
    val uiState: StateFlow<ProductsUiState> = _uiState.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    init {
        loadProducts()
    }

    fun onSearchChange(query: String) {
        _searchQuery.value = query
        loadProducts(query)
    }

    fun loadProducts(search: String? = _searchQuery.value) {
        viewModelScope.launch {
            _uiState.value = ProductsUiState.Loading
            try {
                val searchParam = if (search.isNullOrEmpty()) null else search
                val res = RetrofitClient.api.getProducts(page = 1, limit = 50, search = searchParam)
                if (res.isSuccessful && res.body()?.data != null) {
                    val list = res.body()!!.data!!
                    val total = res.body()!!.meta?.total ?: list.size
                    _uiState.value = ProductsUiState.Success(list, total)
                } else {
                    _uiState.value = ProductsUiState.Error(res.body()?.error?.message ?: "Error al cargar productos.")
                }
            } catch (e: Exception) {
                _uiState.value = ProductsUiState.Error(e.message ?: "Error de red.")
            }
        }
    }

    fun createProduct(
        sku: String,
        name: String,
        unit: String,
        costPrice: Double,
        salePrice: Double,
        minStock: Double,
        maxStock: Double,
        onComplete: (Boolean, String?) -> Unit
    ) {
        viewModelScope.launch {
            try {
                val body = mapOf(
                    "sku" to sku,
                    "name" to name,
                    "unit" to unit.ifEmpty { "unidad" },
                    "costPrice" to costPrice,
                    "salePrice" to salePrice,
                    "minStock" to minStock,
                    "maxStock" to maxStock,
                    "status" to "active"
                )
                val res = RetrofitClient.api.createProduct(body)
                if (res.isSuccessful) {
                    loadProducts()
                    onComplete(true, null)
                } else {
                    onComplete(false, res.body()?.error?.message ?: "Error al registrar material.")
                }
            } catch (e: Exception) {
                onComplete(false, e.message ?: "Error de conexión.")
            }
        }
    }

    fun deleteProduct(id: String, onComplete: (Boolean, String?) -> Unit) {
        viewModelScope.launch {
            try {
                val res = RetrofitClient.api.deleteProduct(id)
                if (res.isSuccessful) {
                    loadProducts()
                    onComplete(true, null)
                } else {
                    onComplete(false, res.body()?.error?.message ?: "Error al eliminar material.")
                }
            } catch (e: Exception) {
                onComplete(false, e.message ?: "Error de conexión.")
            }
        }
    }
}
