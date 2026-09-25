/**
 * TECTODE Design Tokens - Breakpoints
 */
export const BREAKPOINTS = {
  mobile: 0,
  tablet: 768,
  desktop: 1200,
};

export const getResponsiveLayout = (width) => ({
  isMobile: width < BREAKPOINTS.tablet,
  isTablet: width >= BREAKPOINTS.tablet && width < BREAKPOINTS.desktop,
  isDesktop: width >= BREAKPOINTS.desktop,
});
