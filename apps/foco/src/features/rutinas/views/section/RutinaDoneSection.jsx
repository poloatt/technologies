import React, { useMemo, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { RUTINA_DAY_GROUP_COPY, RUTINA_DONE_GROUP_COPY } from '@shared/copy/agendaTerminology';
import { filterRutinaDoneSectionEntries, partitionDoneEntriesByRutinaDay } from '@shared/habits';
import { getRutinaDayMode } from '@shared/utils/rutinaDayMode';
import { CollapsibleSection, CollapseSectionLabel } from '@shared/components/collapse';
import { collapseSectionCountSx, collapseSectionTitleSx } from '@shared/styles/collapseSectionStyles';
import RutinaDoneCarousel from './RutinaDoneCarousel';

/** Sector Hecho: primero completados hoy, luego cuota del período sin marcar hoy. */
export default function RutinaDoneSection({
  items = [],
  rutina,
  habitsPreferences = {},
  readOnly = false,
  onToggle,
  alignIconsLeft = false,
  collapsible = false,
  collapseThreshold = 5,
  defaultExpanded = false,
  doneHeadingLabel,
  doneTodayLabel,
  doneBeforeLabel,
}) {
  const sectionItems = useMemo(
    () => filterRutinaDoneSectionEntries(items, rutina),
    [items, rutina],
  );

  const shouldCollapseSection = collapsible && sectionItems.length > collapseThreshold;
  const [expanded, setExpanded] = useState(defaultExpanded || !shouldCollapseSection);

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

  const renderDoneGroup = (groupItems, label, alignLeft = false, groupDoneTone = null) => (
    <Box sx={{ width: '100%', minWidth: 0 }}>
      <Typography variant="body2" sx={{ ...collapseSectionTitleSx, mb: 0.5 }}>
        {label}
        <Box component="span" sx={collapseSectionCountSx}>{groupItems.length}</Box>
      </Typography>
      <RutinaDoneCarousel
        items={groupItems}
        rutina={rutina}
        habitsPreferences={habitsPreferences}
        readOnly={readOnly}
        onToggle={onToggle}
        centerWhenFits={alignLeft ? false : undefined}
        doneTone={groupDoneTone}
      />
    </Box>
  );

  const doneContent = hasSplitGroups ? (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, width: '100%' }}>
      {doneOnDay.length > 0 && renderDoneGroup(doneOnDay, todayLabel, alignIconsLeft || defaultExpanded, 'today')}
      {visibleDoneByQuota.length > 0 && renderDoneGroup(visibleDoneByQuota, beforeLabel, true, 'before')}
    </Box>
  ) : (
    <RutinaDoneCarousel
      items={sectionItems}
      rutina={rutina}
      habitsPreferences={habitsPreferences}
      readOnly={readOnly}
      onToggle={onToggle}
      centerWhenFits={alignIconsLeft || defaultExpanded ? false : undefined}
      // Sin forzar tono de grupo: cada entrada resuelve today/before canónicamente.
      doneTone={null}
    />
  );

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
