import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  COLORS,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
} from '../../design-system/tokens';
import { TTBadge, TTButton, TTCard } from '../../design-system/components';
import { TecodeLogo } from '../../components/TecodeLogo';

/**
 * LandingScreen - Landing Page Pública TECTODE ERP
 * Estética Tech / Gaming / SaaS Premium
 */
export default function LandingScreen({ onGoLogin }) {
  const [activeTab, setActiveTab] = useState('ERP');

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* NAVBAR */}
      <View style={styles.navbar}>
        <View style={styles.navBrand}>
          <TecodeLogo size="md" />
        </View>

        <View style={styles.navLinks}>
          <Text style={styles.navLink}>Productos</Text>
          <Text style={styles.navLink}>Soluciones</Text>
          <Text style={styles.navLink}>Tecnología</Text>
          <Text style={styles.navLink}>Empresa</Text>
        </View>

        <View style={styles.navActions}>
          <TTButton variant="ghost" size="sm" onPress={onGoLogin}>
            Iniciar Sesión
          </TTButton>
          <TTButton variant="primary" size="sm" onPress={onGoLogin}>
            Comenzar
          </TTButton>
        </View>
      </View>

      {/* HERO SECTION */}
      <View style={styles.heroSection}>
        <View style={styles.heroBadgeBox}>
          <TTBadge value="active" label="TEC[ODE ENTERPRISE 2026" variant="accent" />
        </View>

        <Text style={styles.heroTitle}>
          GESTIONA. <Text style={styles.heroHighlight}>CRECE.</Text> DOMINA.
        </Text>

        <Text style={styles.heroSubtitle}>
          El ecosistema tecnológico definitivo para operar, controlar y escalar tu empresa con velocidad y precisión sin precedentes.
        </Text>

        <View style={styles.heroCtaRow}>
          <TTButton variant="primary" size="lg" onPress={onGoLogin} style={styles.ctaMain}>
            Comenzar Ahora →
          </TTButton>
          <TTButton variant="secondary" size="lg" onPress={onGoLogin}>
            Conocer Tec[ode
          </TTButton>
        </View>

        {/* METRICAS DE CONFIANZA */}
        <View style={styles.trustGrid}>
          <View style={styles.trustItem}>
            <Text style={styles.trustNumber}>99.99%</Text>
            <Text style={styles.trustLabel}>Disponibilidad SLA</Text>
          </View>
          <View style={styles.trustItem}>
            <Text style={styles.trustNumber}>Multi-tenant</Text>
            <Text style={styles.trustLabel}>Aislamiento Robusto</Text>
          </View>
          <View style={styles.trustItem}>
            <Text style={styles.trustNumber}>22+</Text>
            <Text style={styles.trustLabel}>Módulos Integrados</Text>
          </View>
          <View style={styles.trustItem}>
            <Text style={styles.trustNumber}>100%</Text>
            <Text style={styles.trustLabel}>Control en Tiempo Real</Text>
          </View>
        </View>
      </View>

      {/* ECOSISTEMA SECTION */}
      <View style={styles.section}>
        <Text style={styles.sectionPre}>ECOSISTEMA INTEGRADO</Text>
        <Text style={styles.sectionTitle}>UN ECOSISTEMA. INFINITAS FORMAS DE CRECER.</Text>
        <Text style={styles.sectionSub}>
          Módulos diseñados para sincronizarse entre sí automáticamente sin silos de información.
        </Text>

        <View style={styles.ecosystemGrid}>
          <TTCard title="⚡ ERP CORE" subtitle="Gestión Central & RBAC" style={styles.ecoCard}>
            <Text style={styles.ecoText}>
              Control de roles, permisos finos, sucursales y auditoría inmutable de cada transacción.
            </Text>
          </TTCard>

          <TTCard title="📦 INVENTARIO" subtitle="Multidepósito & Trazabilidad" style={styles.ecoCard}>
            <Text style={styles.ecoText}>
              Kardex en tiempo real, alertas de stock mínimo y trazabilidad de movimientos.
            </Text>
          </TTCard>

          <TTCard title="💰 FINANZAS" subtitle="Cuentas & Presupuestos" style={styles.ecoCard}>
            <Text style={styles.ecoText}>
              Ingresos, gastos, presupuestos por categoría y estados financieros automáticos.
            </Text>
          </TTCard>

          <TTCard title="🎯 CRM" subtitle="Leads & Conversión" style={styles.ecoCard}>
            <Text style={styles.ecoText}>
              Embudo de oportunidades comerciales y seguimiento de interacción con clientes.
            </Text>
          </TTCard>

          <TTCard title="⚙️ PRODUCCIÓN" subtitle="BOM & Órdenes de Trabajo" style={styles.ecoCard}>
            <Text style={styles.ecoText}>
              Explosión de insumos de materiales (BOM) y consumo directo de materias primas.
            </Text>
          </TTCard>

          <TTCard title="👔 RRHH" subtitle="Gestión de Personal" style={styles.ecoCard}>
            <Text style={styles.ecoText}>
              Expediente digital de empleados, departamentos y ciclos de vida de colaboradores.
            </Text>
          </TTCard>
        </View>
      </View>

      {/* PRODUCT MOCKUP DEMO SECTION */}
      <View style={styles.section}>
        <Text style={styles.sectionPre}>EXPERIENCIA DE PRODUCTO</Text>
        <Text style={styles.sectionTitle}>Diseñado para el siguiente movimiento.</Text>

        <View style={styles.productMockupBox}>
          <View style={styles.mockupHeader}>
            <View style={styles.mockupDots}>
              <View style={[styles.dot, styles.dotRed]} />
              <View style={[styles.dot, styles.dotYellow]} />
              <View style={[styles.dot, styles.dotGreen]} />
            </View>
            <Text style={styles.mockupUrl}>https://tec-ode.app/dashboard</Text>
          </View>

          <View style={styles.mockupBody}>
            <View style={styles.mockupKpis}>
              <View style={styles.mockKpi}>
                <Text style={styles.mockKpiLabel}>Ventas del Mes</Text>
                <Text style={styles.mockKpiVal}>$128,450.00</Text>
                <Text style={styles.mockKpiTrend}>↑ +12.4% este periodo</Text>
              </View>
              <View style={styles.mockKpi}>
                <Text style={styles.mockKpiLabel}>Resultado Neto</Text>
                <Text style={styles.mockKpiVal}>$94,200.00</Text>
                <Text style={styles.mockKpiTrend}>↑ +8.1% este periodo</Text>
              </View>
              <View style={styles.mockKpi}>
                <Text style={styles.mockKpiLabel}>Salud Inventario</Text>
                <Text style={[styles.mockKpiVal, { color: COLORS.accent }]}>87% Saludable</Text>
                <Text style={styles.mockKpiTrend}>Optimizado</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* VENTAJAS COMPETITIVAS */}
      <View style={styles.section}>
        <Text style={styles.sectionPre}>POR QUÉ TEC[ODE</Text>
        <Text style={styles.sectionTitle}>Ventajas estratégicas para tu operación.</Text>

        <View style={styles.advantagesGrid}>
          <View style={styles.advantageItem}>
            <Text style={styles.advIcon}>🕹️</Text>
            <Text style={styles.advTitle}>Control Total</Text>
            <Text style={styles.advText}>
              Visibilidad completa de stock, dinero y operaciones desde cualquier dispositivo.
            </Text>
          </View>

          <View style={styles.advantageItem}>
            <Text style={styles.advIcon}>⚡</Text>
            <Text style={styles.advTitle}>Velocidad Instantánea</Text>
            <Text style={styles.advText}>
              Arquitectura ultra-rápida construida sobre React Native y APIs de baja latencia.
            </Text>
          </View>

          <View style={styles.advantageItem}>
            <Text style={styles.advIcon}>🤖</Text>
            <Text style={styles.advTitle}>Automatización</Text>
            <Text style={styles.advText}>
              Validaciones estrictas y conciliaciones atómicas para evitar errores humanos.
            </Text>
          </View>

          <View style={styles.advantageItem}>
            <Text style={styles.advIcon}>📈</Text>
            <Text style={styles.advTitle}>Escalabilidad</Text>
            <Text style={styles.advText}>
              Diseñado para soportar múltiples empresas, sucursales y miles de transacciones.
            </Text>
          </View>
        </View>
      </View>

      {/* CTA FOOTER SECTION */}
      <View style={styles.ctaSection}>
        <Text style={styles.ctaPre}>UN SOLO ECOSISTEMA</Text>
        <Text style={styles.ctaTitle}>TU NEGOCIO. UN SOLO ECOSISTEMA.</Text>
        <Text style={styles.ctaSub}>
          Eleva la gestión de tu empresa con la plataforma más moderna del mercado.
        </Text>

        <TTButton variant="primary" size="lg" onPress={onGoLogin} style={styles.ctaBtn}>
          Comenzar Ahora →
        </TTButton>
      </View>

      {/* FOOTER */}
      <View style={styles.footer}>
        <Text style={styles.footerBrand}>Tec[ode ERP Enterprise © 2026</Text>
        <Text style={styles.footerSub}>Todos los derechos reservados.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Navbar
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  navBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  brandLogoBox: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogoText: {
    color: COLORS.textPrimary,
    fontWeight: '900',
    fontSize: 20,
    fontFamily: TYPOGRAPHY.fontFamily.display,
  },
  brandName: {
    color: COLORS.textPrimary,
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.extrabold,
    fontFamily: TYPOGRAPHY.fontFamily.display,
  },
  brandTag: {
    color: COLORS.accent,
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  navLinks: {
    flexDirection: 'row',
    gap: SPACING.xl,
  },
  navLink: {
    color: COLORS.textSecondary,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  navActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  // Hero Section
  heroSection: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING['3xl'],
    alignItems: 'center',
    textAlign: 'center',
    gap: SPACING.lg,
    maxWidth: 900,
    alignSelf: 'center',
  },
  heroBadgeBox: {
    alignSelf: 'center',
  },
  heroTitle: {
    fontSize: TYPOGRAPHY.fontSize['4xl'],
    fontWeight: TYPOGRAPHY.fontWeight.extrabold,
    color: COLORS.textPrimary,
    textAlign: 'center',
    fontFamily: TYPOGRAPHY.fontFamily.display,
    lineHeight: 46,
  },
  heroHighlight: {
    color: COLORS.accent,
  },
  heroSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: COLORS.textMuted,
    textAlign: 'center',
    maxWidth: 640,
    fontFamily: TYPOGRAPHY.fontFamily.ui,
    lineHeight: 26,
  },
  heroCtaRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  ctaMain: {
    minWidth: 180,
  },

  // Trust Grid
  trustGrid: {
    flexDirection: 'row',
    gap: SPACING.xl,
    marginTop: SPACING.xl,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  trustItem: {
    alignItems: 'center',
    gap: 2,
    minWidth: 140,
  },
  trustNumber: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.extrabold,
    color: COLORS.textPrimary,
    fontFamily: TYPOGRAPHY.fontFamily.display,
  },
  trustLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textMuted,
  },

  // General Section
  section: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING['3xl'],
    maxWidth: 1100,
    alignSelf: 'center',
    width: '100%',
    gap: SPACING.md,
  },
  sectionPre: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.accent,
    letterSpacing: 1,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize['3xl'],
    fontWeight: TYPOGRAPHY.fontWeight.extrabold,
    color: COLORS.textPrimary,
    textAlign: 'center',
    fontFamily: TYPOGRAPHY.fontFamily.display,
  },
  sectionSub: {
    fontSize: TYPOGRAPHY.fontSize.md,
    color: COLORS.textMuted,
    textAlign: 'center',
    maxWidth: 600,
    alignSelf: 'center',
  },

  // Ecosystem Grid
  ecosystemGrid: {
    flexDirection: 'row',
    gap: SPACING.lg,
    flexWrap: 'wrap',
    marginTop: SPACING.lg,
  },
  ecoCard: {
    flex: 1,
    minWidth: 300,
  },
  ecoText: {
    color: COLORS.textSecondary,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: 20,
  },

  // Product Mockup
  productMockupBox: {
    backgroundColor: COLORS.cardElevated,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginTop: SPACING.lg,
  },
  mockupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.md,
  },
  mockupDots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: RADIUS.pill,
  },
  dotRed: { backgroundColor: '#EF4444' },
  dotYellow: { backgroundColor: '#F59E0B' },
  dotGreen: { backgroundColor: '#10B981' },
  mockupUrl: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.mono,
  },
  mockupBody: {
    padding: SPACING.xl,
  },
  mockupKpis: {
    flexDirection: 'row',
    gap: SPACING.md,
    flexWrap: 'wrap',
  },
  mockKpi: {
    flex: 1,
    minWidth: 180,
    backgroundColor: COLORS.card,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.xs,
  },
  mockKpiLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textMuted,
  },
  mockKpiVal: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
  },
  mockKpiTrend: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.accent,
  },

  // Advantages Grid
  advantagesGrid: {
    flexDirection: 'row',
    gap: SPACING.lg,
    flexWrap: 'wrap',
    marginTop: SPACING.lg,
  },
  advantageItem: {
    flex: 1,
    minWidth: 220,
    backgroundColor: COLORS.card,
    padding: SPACING.xl,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.xs,
  },
  advIcon: {
    fontSize: 28,
    marginBottom: SPACING.xs,
  },
  advTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
  },
  advText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textMuted,
    lineHeight: 20,
  },

  // CTA Section
  ctaSection: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING['3xl'],
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    gap: SPACING.md,
  },
  ctaPre: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.accent,
    letterSpacing: 1,
  },
  ctaTitle: {
    fontSize: TYPOGRAPHY.fontSize['3xl'],
    fontWeight: TYPOGRAPHY.fontWeight.extrabold,
    color: COLORS.textPrimary,
    textAlign: 'center',
    fontFamily: TYPOGRAPHY.fontFamily.display,
  },
  ctaSub: {
    fontSize: TYPOGRAPHY.fontSize.md,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  ctaBtn: {
    marginTop: SPACING.md,
    minWidth: 200,
  },

  // Footer
  footer: {
    paddingVertical: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  footerBrand: {
    color: COLORS.textSecondary,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  footerSub: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
});
