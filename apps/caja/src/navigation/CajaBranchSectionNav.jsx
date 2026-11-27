import React, { useMemo } from 'react';
import {
  Box,
  Card,
  CardActionArea,
  Chip,
  Grid,
  Typography,
} from '@mui/material';
import {
  ChevronRightOutlined,
  ConstructionOutlined,
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  getCajaBranchPages,
  getFinanzasBranchPages,
  getInventarioBranchPages,
  getPropiedadesBranchPages,
  isPathActive,
} from '@shared/navigation/appNavResolver';
import { DynamicIcon } from '@shared/components/common/DynamicIcon';
import useResponsive from '@shared/hooks/useResponsive';
import { useCajaSectionStats } from './useCajaSectionStats';
import {
  hubSectionBodySx,
  hubSectionHeaderSx,
  getHubSectionCardSx,
  hubGridContainerSx,
  hubGridItemSx,
} from '@shared/styles/hubSectionStyles';

function resolveActiveSectionId(pathname, pages) {
  const match = [...pages]
    .sort((a, b) => b.path.length - a.path.length)
    .find((page) => isPathActive(pathname, page.path));
  return match?.id ?? null;
}

function formatCount(count, loading) {
  if (loading) return '—';
  if (count == null) return null;
  return count === 1 ? '1 registro' : `${count} registros`;
}

/**
 * Navegación por secciones de una rama Atta (hub o strip), mismo patrón Propiedades/Finanzas.
 */
export default function CajaBranchSectionNav({
  branchId,
  sectionMeta = {},
  statsEndpoints = {},
  hubSectionExtras = {},
  hubSectionCards = {},
  hubExcludePageIds = [],
  stripPages,
  ariaLabel,
  variant = 'hub',
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isMobile } = useResponsive();
  const { counts, loading } = useCajaSectionStats(statsEndpoints);

  const pages = useMemo(() => {
    if (variant === 'strip') {
      if (stripPages) {
        return typeof stripPages === 'function' ? stripPages() : stripPages;
      }
      if (branchId === 'propiedades') return getPropiedadesBranchPages();
      if (branchId === 'inventario') return getInventarioBranchPages();
      return getFinanzasBranchPages();
    }
    return getCajaBranchPages(branchId);
  }, [branchId, variant, stripPages]);

  const activeId = useMemo(
    () => resolveActiveSectionId(pathname, pages),
    [pathname, pages],
  );

  const isStrip = variant === 'strip';

  const hubPages = useMemo(() => {
    if (isStrip || !hubExcludePageIds?.length) return pages;
    const exclude = new Set(hubExcludePageIds);
    return pages.filter((page) => !exclude.has(page.id));
  }, [pages, isStrip, hubExcludePageIds]);

  const usesHubCardLayout = !isStrip && (
    branchId === 'finanzas' || branchId === 'propiedades' || branchId === 'inventario'
  );
  // Página principal (Finanzas): en desktop las secciones van en columna, a ancho completo.
  const stackHubSections = !isStrip && branchId === 'finanzas';

  const hubStackSx = {
    display: 'flex',
    flexDirection: 'column',
    gap: 1.5,
    width: '100%',
    '& .hub-section-card': {
      minHeight: 'auto',
      height: 'auto',
    },
    '& .hub-section-body': {
      minHeight: 'auto',
      flex: '0 1 auto',
    },
  };

  const handleNavigate = (page) => {
    if (page.isUnderConstruction) return;
    if (!isPathActive(pathname, page.path)) {
      navigate(page.path);
    }
  };

  const neutralSectionIcons =
    branchId === 'finanzas' || branchId === 'propiedades' || branchId === 'inventario';

  const renderCardHeader = (page, { isActive, disabled, meta, countLabel, compact }) => (
    <Box
      sx={{
        display: 'flex',
        alignItems: compact ? 'center' : 'flex-start',
        gap: 1.25,
        width: '100%',
      }}
    >
      {neutralSectionIcons ? (
        <DynamicIcon
          iconKey={page.iconKey}
          size="small"
          sx={{
            flexShrink: 0,
            color: disabled ? 'text.disabled' : 'text.primary',
          }}
        />
      ) : (
        <Box
          sx={{
            width: compact ? 36 : 44,
            height: compact ? 36 : 44,
            borderRadius: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            bgcolor: disabled ? 'action.hover' : `${meta.accent || '#90A4AE'}22`,
            color: disabled ? 'text.disabled' : (meta.accent || 'primary.main'),
          }}
        >
          <DynamicIcon iconKey={page.iconKey} size="small" />
        </Box>
      )}

      <Box sx={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          <Typography
            variant={compact ? 'body2' : 'subtitle1'}
            sx={{ fontWeight: isActive ? 600 : 500, lineHeight: 1.2 }}
          >
            {page.label}
          </Typography>
          {disabled && (
            <Chip
              size="small"
              icon={<ConstructionOutlined sx={{ fontSize: '14px !important' }} />}
              label="Próximamente"
              sx={{ height: 20, fontSize: '0.65rem' }}
            />
          )}
        </Box>
        {!disabled && !hubSectionExtras[page.id] && !hubSectionCards[page.id] && (loading || countLabel) && (
          <Typography
            variant="caption"
            color={isActive ? 'primary.main' : 'text.secondary'}
            sx={{ display: 'block', mt: 0.5, fontWeight: isActive ? 600 : 400 }}
          >
            {loading ? 'Cargando…' : countLabel}
          </Typography>
        )}
      </Box>

      {!disabled && (
        <ChevronRightOutlined
          sx={{
            flexShrink: 0,
            color: isActive ? 'primary.main' : 'text.disabled',
            fontSize: compact ? 20 : 22,
          }}
        />
      )}
    </Box>
  );

  const renderCard = (page) => {
    const meta = sectionMeta[page.id] || {};
    const isActive = page.id === activeId;
    const disabled = page.isUnderConstruction;
    const countLabel = formatCount(counts[page.id], loading);
    const HubCard = !isStrip ? hubSectionCards[page.id] : null;
    const HubExtra = !isStrip && !HubCard ? hubSectionExtras[page.id] : null;

    if (HubCard) {
      const HubCardComponent = HubCard;
      return (
        <Box key={page.id} sx={hubGridItemSx}>
          <HubCardComponent />
        </Box>
      );
    }

    const isFinanzasHub = usesHubCardLayout;
    const cardSx = {
      ...(isFinanzasHub ? getHubSectionCardSx(isActive) : {
        height: '100%',
        width: '100%',
        border: '1px solid',
        borderColor: isActive ? 'primary.main' : 'divider',
        bgcolor: isActive ? 'action.selected' : 'background.paper',
      }),
      opacity: disabled ? 0.72 : 1,
      transition: 'border-color 0.15s, background-color 0.15s',
    };

    if (HubExtra) {
      const ExtraContent = HubExtra;
      return (
        <Box sx={isFinanzasHub ? hubGridItemSx : { width: '100%' }}>
        <Card key={page.id} elevation={0} sx={cardSx}>
          <CardActionArea
            onClick={() => handleNavigate(page)}
            disabled={disabled}
            sx={isFinanzasHub ? hubSectionHeaderSx : { px: 1.5, py: 1.25, display: 'block' }}
          >
            {renderCardHeader(page, { isActive, disabled, meta, countLabel, compact: false })}
          </CardActionArea>
          <Box
            sx={isFinanzasHub ? { ...hubSectionBodySx, pt: 0 } : { px: 1.5, pb: 1.25, pt: 0 }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <ExtraContent />
          </Box>
        </Card>
        </Box>
      );
    }

    return (
      <Box sx={isFinanzasHub ? hubGridItemSx : { width: '100%' }}>
        <Card key={page.id} elevation={0} sx={cardSx}>
          <CardActionArea
            onClick={() => handleNavigate(page)}
            disabled={disabled}
            sx={
              isFinanzasHub && !isStrip
                ? { ...hubSectionHeaderSx, height: '100%', flex: 1 }
                : {
                    height: '100%',
                    flex: isFinanzasHub ? 1 : undefined,
                    px: isStrip ? 1.25 : 1.5,
                    py: isStrip ? 1 : 1.5,
                    display: 'flex',
                    alignItems: 'stretch',
                    justifyContent: 'flex-start',
                  }
            }
          >
          {renderCardHeader(page, {
            isActive,
            disabled,
            meta,
            countLabel,
            compact: isStrip,
          })}
          </CardActionArea>
        </Card>
      </Box>
    );
  };

  // En mobile las pages viven en BottomNavigation; el strip duplicaría el footer.
  if (isStrip && isMobile) return null;
  if (pages.length === 0) return null;

  const renderSectionGroup = (sectionPages) => {
    if (stackHubSections) {
      return (
        <Box sx={hubStackSx}>
          {sectionPages.map((page) => (
            <Box key={page.id} sx={{ width: '100%' }}>
              {renderCard(page)}
            </Box>
          ))}
        </Box>
      );
    }

    return (
      <Grid container spacing={1.5} sx={usesHubCardLayout ? hubGridContainerSx : undefined}>
        {sectionPages.map((page) => (
          <Grid
            item
            key={page.id}
            xs={12}
            sm={6}
            md={4}
            sx={usesHubCardLayout ? hubGridItemSx : undefined}
          >
            {renderCard(page)}
          </Grid>
        ))}
      </Grid>
    );
  };

  return (
    <Box
      component="nav"
      aria-label={ariaLabel}
      sx={{
        width: '100%',
        mb: isStrip ? 2 : 3,
      }}
    >
      {isStrip ? (
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            overflowX: 'auto',
            pb: 0.5,
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          {pages.map((page) => (
            <Box key={page.id} sx={{ minWidth: { xs: 200, sm: 220 }, maxWidth: 280, flex: '0 0 auto' }}>
              {renderCard(page)}
            </Box>
          ))}
        </Box>
      ) : (
        renderSectionGroup(hubPages)
      )}
    </Box>
  );
}
