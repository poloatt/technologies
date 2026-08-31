import React, { useMemo, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { RUTINA_DAY_GROUP_COPY, RUTINA_DONE_GROUP_COPY } from '@shared/copy/agendaTerminology';
import { filterRutinaDoneSectionEntries, partitionDoneEntriesByRutinaDay } from '@shared/habits';
import { getRutinaDayMode } from '@shared/utils/rutinaDayMode';
import { CollapsibleSection, CollapseSectionLabel } from '@shared/components/collapse';
import CollapseSectionToggle from '@shared/components/common/CollapseSectionToggle';
import useResponsive from '@shared/hooks/useResponsive';
import {
  collapseSectionCountSx,
  collapseSectionTitleSx,
  getCollapseSectionCarouselBodySx,
} from '@shared/styles/collapseSectionStyles';
import RutinaDoneCarousel from './RutinaDoneCarousel';
import RutinaDoneDetailRows from './RutinaDoneDetailRows';

/** Sector Hecho: primero completados hoy, luego cuota del período sin marcar hoy. */
export default function RutinaDoneSection({
  items = [],
  rutina,
  habits = null,
  habitsPreferences = {},
  readOnly = false,
  onToggle,
  alignIconsLeft = false,
  collapsible = false,
  collapseThreshold = 5,
  defaultExpanded = false,
  /** 'carousel' = colapsado muestra iconos en línea; expandido muestra filas por rutina. */
  collapsePreviewMode = 'hide',
  doneHeadingLabel,
  doneTodayLabel,
  doneBeforeLabel,
  stackVariant = 'inline',
}) {
  const { isMobileOrTablet } = useResponsive();
  const sectionItems = useMemo(
    () => filterRutinaDoneSectionEntries(items, rutina),
    [items, rutina],
  );

  const usesCarouselPreview = collapsePreviewMode === 'carousel';
  const shouldCollapseSection = collapsible && (
    usesCarouselPreview || sectionItems.length > collapseThreshold
  );
  const [expanded, setExpanded] = useState(
    defaultExpanded || (!shouldCollapseSection && !usesCarouselPreview),
  );

  const { doneOnDay, doneByQuota } = useMemo(
    () => partitionDoneEntriesByRutinaDay(sectionItems, rutina),
    [sectionItems, rutina],
  );

  const dayMode = rutina?.fecha ? getRutinaDayMode(rutina.fecha) : 'today';
  const visibleDoneByQuota = dayMode === 'today' ? [] : doneByQuota;

  const hasSplitGroups = doneOnDay.length > 0 && visibleDoneByQuota.length > 0;
  const todayLabel = doneTodayLabel || RUTINA_DONE_GROUP_COPY.doneToday;
  const beforeLabel = doneBeforeLabel || RUTINA_DONE_GROUP_COPY.doneBefore;
  const defaultHeadingLabel = RUTINA_DAY_GROUP_COPY.done;
  const headingLabel = useMemo(() => {
    if (!doneHeadingLabel) return defaultHeadingLabel;
    if (hasSplitGroups) return doneHeadingLabel;
    if (doneOnDay.length === 0 && visibleDoneByQuota.length > 0) {
      return beforeLabel;
    }
    if (doneOnDay.length > 0 && visibleDoneByQuota.length === 0) {
      return doneTodayLabel || doneHeadingLabel;
    }
    return doneHeadingLabel;
  }, [
    doneHeadingLabel,
    doneTodayLabel,
    beforeLabel,
    hasSplitGroups,
    doneOnDay.length,
    visibleDoneByQuota.length,
    defaultHeadingLabel,
  ]);

  if (!sectionItems.length) return null;

  const renderDoneCarousel = (carouselItems, alignLeft = false, groupDoneTone = null) => (
    <RutinaDoneCarousel
      items={carouselItems}
      rutina={rutina}
      habitsPreferences={habitsPreferences}
      readOnly={readOnly}
      onToggle={onToggle}
      centerWhenFits={alignLeft ? false : undefined}
      doneTone={groupDoneTone}
    />
  );

  const renderDoneGroup = (groupItems, label, alignLeft = false, groupDoneTone = null) => (
    <Box sx={{ width: '100%', minWidth: 0 }}>
      <Typography variant="body2" sx={{ ...collapseSectionTitleSx, mb: 0.5 }}>
        {label}
        <Box component="span" sx={collapseSectionCountSx}>{groupItems.length}</Box>
      </Typography>
      {renderDoneCarousel(groupItems, alignLeft, groupDoneTone)}
    </Box>
  );

  const renderDoneDetailRows = (detailItems) => (
    <RutinaDoneDetailRows
      items={detailItems}
      rutina={rutina}
      habits={habits}
      readOnly={readOnly}
      onToggle={onToggle}
      stackVariant={stackVariant}
    />
  );

  const carouselContent = hasSplitGroups ? (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, width: '100%' }}>
      {doneOnDay.length > 0 && renderDoneGroup(doneOnDay, todayLabel, alignIconsLeft, 'today')}
      {visibleDoneByQuota.length > 0 && renderDoneGroup(visibleDoneByQuota, beforeLabel, true, 'before')}
    </Box>
  ) : (
    renderDoneCarousel(sectionItems, alignIconsLeft || defaultExpanded)
  );

  const expandedDetailContent = hasSplitGroups ? (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, width: '100%' }}>
      {doneOnDay.length > 0 && (
        <Box sx={{ width: '100%', minWidth: 0 }}>
          <Typography variant="body2" sx={{ ...collapseSectionTitleSx, mb: 0.5 }}>
            {todayLabel}
            <Box component="span" sx={collapseSectionCountSx}>{doneOnDay.length}</Box>
          </Typography>
          {renderDoneDetailRows(doneOnDay)}
        </Box>
      )}
      {visibleDoneByQuota.length > 0 && (
        <Box sx={{ width: '100%', minWidth: 0 }}>
          <Typography variant="body2" sx={{ ...collapseSectionTitleSx, mb: 0.5 }}>
            {beforeLabel}
            <Box component="span" sx={collapseSectionCountSx}>{visibleDoneByQuota.length}</Box>
          </Typography>
          {renderDoneDetailRows(visibleDoneByQuota)}
        </Box>
      )}
    </Box>
  ) : (
    renderDoneDetailRows(sectionItems)
  );

  const doneContent = carouselContent;

  if (shouldCollapseSection && usesCarouselPreview) {
    return (
      <CollapseSectionToggle
        expanded={expanded}
        onToggle={() => setExpanded((prev) => !prev)}
        title={headingLabel}
        count={sectionItems.length}
        showDivider={expanded}
        contentSx={getCollapseSectionCarouselBodySx(isMobileOrTablet, { expanded })}
      >
        {expanded ? expandedDetailContent : carouselContent}
      </CollapseSectionToggle>
    );
  }

  if (shouldCollapseSection) {
    return (
      <CollapsibleSection
        title={headingLabel}
        count={sectionItems.length}
        collapsible
        expanded={expanded}
        onToggle={() => setExpanded((prev) => !prev)}
        animated
      >
        {doneContent}
      </CollapsibleSection>
    );
  }

  return (
    <CollapseSectionLabel
      title={headingLabel}
      count={sectionItems.length}
    >
      {doneContent}
    </CollapseSectionLabel>
  );
}
