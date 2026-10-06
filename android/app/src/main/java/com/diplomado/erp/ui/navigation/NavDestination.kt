package com.diplomado.erp.ui.navigation

sealed class NavDestination(val route: String) {
    data object Login : NavDestination("login")
    data object Main : NavDestination("main")
    data object Dashboard : NavDestination("dashboard")
    data object Projects : NavDestination("projects")
    data object ProjectDetail : NavDestination("project_detail/{projectId}") {
        fun createRoute(projectId: String) = "project_detail/$projectId"
    }
    data object Products : NavDestination("products")
    data object Stock : NavDestination("stock")
    data object Movements : NavDestination("movements")
    data object Purchases : NavDestination("purchases")
    data object Sales : NavDestination("sales")
    data object Finance : NavDestination("finance")
    data object Users : NavDestination("users")
    data object Leads : NavDestination("leads")
    data object Employees : NavDestination("employees")
    data object More : NavDestination("more")
}
