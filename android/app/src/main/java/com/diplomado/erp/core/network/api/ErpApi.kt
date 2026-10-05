package com.diplomado.erp.core.network.api

import com.diplomado.erp.core.network.dto.*
import retrofit2.Response
import retrofit2.http.*

interface ErpApi {

    @POST("auth/login")
    @Headers("No-Authentication: true")
    suspend fun login(@Body request: LoginRequest): Response<ApiResponse<LoginResponse>>

    @POST("auth/refresh")
    @Headers("No-Authentication: true")
    suspend fun refresh(@Body request: RefreshRequest): Response<ApiResponse<RefreshResponse>>

    @GET("auth/me")
    suspend fun getMe(): Response<ApiResponse<MeResponse>>

    @POST("auth/change-password")
    suspend fun changePassword(@Body request: ChangePasswordRequest): Response<ApiResponse<Unit>>

    @POST("auth/logout")
    suspend fun logout(): Response<ApiResponse<Unit>>

    // Reports
    @GET("reports/kpis")
    suspend fun getKpis(): Response<ApiResponse<KpisDataDto>>

    // Products
    @GET("products")
    suspend fun getProducts(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20,
        @Query("search") search: String? = null
    ): Response<ApiResponse<List<ProductDto>>>

    @POST("products")
    suspend fun createProduct(@Body product: Map<String, @JvmSuppressWildcards Any?>): Response<ApiResponse<ProductDto>>

    @PATCH("products/{id}")
    suspend fun updateProduct(@Path("id") id: String, @Body product: Map<String, @JvmSuppressWildcards Any?>): Response<ApiResponse<ProductDto>>

    @DELETE("products/{id}")
    suspend fun deleteProduct(@Path("id") id: String): Response<ApiResponse<Unit>>

    // Warehouses
    @GET("warehouses")
    suspend fun getWarehouses(): Response<ApiResponse<List<WarehouseDto>>>

    // Inventory
    @GET("inventory/stock")
    suspend fun getStock(
        @Query("warehouseId") warehouseId: String? = null,
        @Query("productId") productId: String? = null
    ): Response<ApiResponse<List<StockLevelDto>>>

    @GET("inventory/movements")
    suspend fun getMovements(
        @Query("type") type: String? = null,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20
    ): Response<ApiResponse<List<MovementDto>>>

    @POST("inventory/entries")
    suspend fun createEntry(@Body request: Map<String, @JvmSuppressWildcards Any?>): Response<ApiResponse<MovementDto>>

    @POST("inventory/exits")
    suspend fun createExit(@Body request: Map<String, @JvmSuppressWildcards Any?>): Response<ApiResponse<MovementDto>>

    @POST("inventory/adjustments")
    suspend fun createAdjustment(@Body request: Map<String, @JvmSuppressWildcards Any?>): Response<ApiResponse<MovementDto>>

    @POST("inventory/transfers")
    suspend fun createTransfer(@Body request: Map<String, @JvmSuppressWildcards Any?>): Response<ApiResponse<MovementDto>>

    // Suppliers & Customers
    @GET("suppliers")
    suspend fun getSuppliers(): Response<ApiResponse<List<SupplierDto>>>

    @GET("customers")
    suspend fun getCustomers(): Response<ApiResponse<List<CustomerDto>>>

    // Purchase & Sales Orders
    @GET("purchase-orders")
    suspend fun getPurchaseOrders(
        @Query("status") status: String? = null,
        @Query("page") page: Int = 1
    ): Response<ApiResponse<List<PurchaseOrderDto>>>

    @POST("purchase-orders")
    suspend fun createPurchaseOrder(@Body order: Map<String, @JvmSuppressWildcards Any?>): Response<ApiResponse<PurchaseOrderDto>>

    @POST("purchase-orders/{id}/approve")
    suspend fun approvePurchaseOrder(@Path("id") id: String, @Body body: Map<String, String> = emptyMap()): Response<ApiResponse<PurchaseOrderDto>>

    @POST("purchase-orders/{id}/reject")
    suspend fun rejectPurchaseOrder(@Path("id") id: String, @Body reason: Map<String, String>): Response<ApiResponse<PurchaseOrderDto>>

    @GET("sales-orders")
    suspend fun getSalesOrders(
        @Query("status") status: String? = null,
        @Query("page") page: Int = 1
    ): Response<ApiResponse<List<SalesOrderDto>>>

    @POST("sales-orders")
    suspend fun createSalesOrder(@Body order: Map<String, @JvmSuppressWildcards Any?>): Response<ApiResponse<SalesOrderDto>>

    @POST("sales-orders/{id}/approve")
    suspend fun approveSalesOrder(@Path("id") id: String, @Body body: Map<String, String> = emptyMap()): Response<ApiResponse<SalesOrderDto>>

    @POST("sales-orders/{id}/reject")
    suspend fun rejectSalesOrder(@Path("id") id: String, @Body reason: Map<String, String>): Response<ApiResponse<SalesOrderDto>>

    // Finance
    @GET("finance/accounts")
    suspend fun getFinanceAccounts(): Response<ApiResponse<List<AccountDto>>>

    @POST("finance/accounts")
    suspend fun createFinanceAccount(@Body account: Map<String, @JvmSuppressWildcards Any?>): Response<ApiResponse<AccountDto>>

    @GET("finance/incomes")
    suspend fun getIncomes(): Response<ApiResponse<List<IncomeDto>>>

    @POST("finance/incomes")
    suspend fun createIncome(@Body income: Map<String, @JvmSuppressWildcards Any?>): Response<ApiResponse<IncomeDto>>

    @POST("finance/incomes/{id}/void")
    suspend fun voidIncome(@Path("id") id: String, @Body reason: Map<String, String>): Response<ApiResponse<IncomeDto>>

    @GET("finance/expenses")
    suspend fun getExpenses(): Response<ApiResponse<List<ExpenseDto>>>

    @POST("finance/expenses")
    suspend fun createExpense(@Body expense: Map<String, @JvmSuppressWildcards Any?>): Response<ApiResponse<ExpenseDto>>

    @POST("finance/expenses/{id}/void")
    suspend fun voidExpense(@Path("id") id: String, @Body reason: Map<String, String>): Response<ApiResponse<ExpenseDto>>

    // CRM & HR
    @GET("crm/leads")
    suspend fun getLeads(): Response<ApiResponse<List<LeadDto>>>

    @POST("crm/leads")
    suspend fun createLead(@Body lead: Map<String, @JvmSuppressWildcards Any?>): Response<ApiResponse<LeadDto>>

    @PATCH("crm/leads/{id}")
    suspend fun updateLead(@Path("id") id: String, @Body lead: Map<String, @JvmSuppressWildcards Any?>): Response<ApiResponse<LeadDto>>

    @GET("hr/employees")
    suspend fun getEmployees(): Response<ApiResponse<List<EmployeeDto>>>

    @POST("hr/employees")
    suspend fun createEmployee(@Body employee: Map<String, @JvmSuppressWildcards Any?>): Response<ApiResponse<EmployeeDto>>

    @PATCH("hr/employees/{id}")
    suspend fun updateEmployee(@Path("id") id: String, @Body employee: Map<String, @JvmSuppressWildcards Any?>): Response<ApiResponse<EmployeeDto>>

    // Production
    @GET("production/boms")
    suspend fun getBoms(): Response<ApiResponse<List<BomDto>>>

    @GET("production/orders")
    suspend fun getProductionOrders(): Response<ApiResponse<List<ProductionOrderDto>>>

    @POST("production/orders/{id}/release")
    suspend fun releaseProductionOrder(@Path("id") id: String, @Body body: Map<String, String> = emptyMap()): Response<ApiResponse<ProductionOrderDto>>

    @POST("production/orders/{id}/done")
    suspend fun doneProductionOrder(@Path("id") id: String, @Body body: Map<String, String> = emptyMap()): Response<ApiResponse<ProductionOrderDto>>

    @POST("production/orders/{id}/cancel")
    suspend fun cancelProductionOrder(@Path("id") id: String, @Body reason: Map<String, String>): Response<ApiResponse<ProductionOrderDto>>

    // Users & Roles
    @GET("users")
    suspend fun getUsers(): Response<ApiResponse<List<UserDto>>>

    @POST("users")
    suspend fun createUser(@Body user: Map<String, @JvmSuppressWildcards Any?>): Response<ApiResponse<UserDto>>

    @DELETE("users/{id}")
    suspend fun deleteUser(@Path("id") id: String): Response<ApiResponse<Unit>>

    @GET("roles")
    suspend fun getRoles(): Response<ApiResponse<List<RoleDto>>>

    // Audit
    @GET("audit")
    suspend fun getAuditLogs(@Query("limit") limit: Int = 20): Response<ApiResponse<List<AuditLogDto>>>

    // Obras & Centros de Costo (ERP Constructor)
    @GET("projects")
    suspend fun getProjects(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20,
        @Query("status") status: String? = null,
        @Query("search") search: String? = null
    ): Response<ApiResponse<List<ProjectDto>>>

    @GET("projects/{id}")
    suspend fun getProjectById(@Path("id") id: String): Response<ApiResponse<ProjectDto>>

    @POST("projects")
    suspend fun createProject(@Body project: Map<String, @JvmSuppressWildcards Any?>): Response<ApiResponse<ProjectDto>>

    @PATCH("projects/{id}")
    suspend fun updateProject(@Path("id") id: String, @Body project: Map<String, @JvmSuppressWildcards Any?>): Response<ApiResponse<ProjectDto>>

    @GET("cost-centers")
    suspend fun getCostCenters(
        @Query("projectId") projectId: String? = null,
        @Query("search") search: String? = null
    ): Response<ApiResponse<List<CostCenterDto>>>

    @POST("cost-centers")
    suspend fun createCostCenter(@Body costCenter: Map<String, @JvmSuppressWildcards Any?>): Response<ApiResponse<CostCenterDto>>
}
