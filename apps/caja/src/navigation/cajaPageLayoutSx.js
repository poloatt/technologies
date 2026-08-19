/** Contenedor estándar de páginas Caja (hub y subpáginas). */
export const cajaPageLayoutSx = {
  width: '100%',
  maxWidth: 900,
  mx: 'auto',
  px: { xs: 1, sm: 2, md: 3 },
  py: 2,
  pb: {
    xs: 'calc(80px + env(safe-area-inset-bottom, 0px))',
    sm: 4,
  },
  boxSizing: 'border-box',
};
