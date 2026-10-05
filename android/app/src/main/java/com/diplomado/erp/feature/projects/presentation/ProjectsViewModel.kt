package com.diplomado.erp.feature.projects.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.diplomado.erp.core.network.client.RetrofitClient
import com.diplomado.erp.core.network.dto.ProjectDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class ProjectsUiState {
    data object Loading : ProjectsUiState()
    data class Success(val projects: List<ProjectDto>) : ProjectsUiState()
    data class Error(val message: String) : ProjectsUiState()
}

class ProjectsViewModel : ViewModel() {
    private val _uiState = MutableStateFlow<ProjectsUiState>(ProjectsUiState.Loading)
    val uiState: StateFlow<ProjectsUiState> = _uiState.asStateFlow()

    init {
        loadProjects()
    }

    fun loadProjects(search: String? = null) {
        viewModelScope.launch {
            _uiState.value = ProjectsUiState.Loading
            try {
                val res = RetrofitClient.api.getProjects(search = search)
                if (res.isSuccessful) {
                    _uiState.value = ProjectsUiState.Success(res.body()?.data ?: emptyList())
                } else {
                    _uiState.value = ProjectsUiState.Error("No se pudieron cargar las obras de construcción.")
                }
            } catch (e: Exception) {
                _uiState.value = ProjectsUiState.Error(e.message ?: "Error de red al consultar obras.")
            }
        }
    }

    fun createProject(code: String, name: String, location: String, budget: Double, managerName: String, onComplete: (Boolean, String?) -> Unit) {
        viewModelScope.launch {
            try {
                val body = mapOf(
                    "code" to code,
                    "name" to name,
                    "location" to location,
                    "budget" to budget,
                    "managerName" to managerName,
                    "status" to "EN_PROCESO"
                )
                val res = RetrofitClient.api.createProject(body)
                if (res.isSuccessful) {
                    loadProjects()
                    onComplete(true, null)
                } else {
                    onComplete(false, res.body()?.error?.message ?: "Error al registrar la obra.")
                }
            } catch (e: Exception) {
                onComplete(false, e.message ?: "Error de conexión.")
            }
        }
    }
}
