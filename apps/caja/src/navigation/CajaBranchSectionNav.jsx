import React, { useMemo } from 'react';
import {
  Box,
  Card,
  CardActionArea,
  Chip,
  Divider,
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
  resolveCajaToolbarCenter,
  isPathActive,
} from '@shared/navigation/appNavResolver';
import { DynamicIcon } from '@shared/components/common/DynamicIcon';
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
  const { counts, loading } = useCajaSectionStats(statsEndpoints);

  const pages = useMemo(() => {
    if (variant === 'strip') {
      if (stripPages) {
        return typeof stripPages === 'function' ? stripPages() : stripPages;
      }
      return resolveCajaToolbarCenter(pathname);
    }
    return getCajaBranchPages(branchId);
  }, [branchId, pathname, variant, stripPages]);

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

  const { activePages, comingSoonPages } = useMemo(() => {
    const active = [];
    const soon = [];
    const source = isStrip ? pages : hubPages;
    source.forEach((page) => {
      if (page.isUnderConstruction) soon.push(page);
      else active.push(page);
    });
    return { activePages: active, comingSoonPages: soon };
  }, [pages, hubPages, isStrip]);

  const usesHubCardLayout = !isStrip && (
    branchId === 'finanzas' || branchId === 'propiedades' || branchId === 'inventario'
  );
  const splitComingSoonHub = usesHubCardLayout && comingSoonPages.length > 0;

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

  if (pages.length === 0) return null;

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
      ) : splitComingSoonHub ? (
        <>
          <Grid container spacing={1.5} sx={hubGridContainerSx}>
            {activePages.map((page) => (
              <Grid item key={page.id} xs={12} sm={6} md={4} sx={hubGridItemSx}>
                {renderCard(page)}
              </Grid>
            ))}
          </Grid>
          <Divider sx={{ my: 2.5 }} />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: 'block',
              mb: 1.25,
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              fontSize: '0.6875rem',
            }}
          >
            Próximamente
          </Typography>
          <Grid container spacing={1.5} sx={hubGridContainerSx}>
            {comingSoonPages.map((page) => (
              <Grid item key={page.id} xs={12} sm={6} md={4} sx={hubGridItemSx}>
                {renderCard(page)}
              </Grid>
            ))}
          </Grid>
        </>
      ) : (
        <Grid container spacing={1.5} sx={usesHubCardLayout ? hubGridContainerSx : undefined}>
          {(isStrip ? pages : hubPages).map((page) => (
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
      )}
    </Box>
  );
}
