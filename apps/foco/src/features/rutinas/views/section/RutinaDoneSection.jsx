import React, { useMemo, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { RUTINA_DAY_GROUP_COPY, RUTINA_DONE_GROUP_COPY } from '@shared/copy/agendaTerminology';
import { partitionDoneEntriesByRutinaDay } from '@shared/habits';
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
  const shouldCollapse = collapsible && items.length > collapseThreshold;
  const [expanded, setExpanded] = useState(defaultExpanded || !shouldCollapse);

  const { doneOnDay, doneByQuota } = useMemo(
    () => partitionDoneEntriesByRutinaDay(items, rutina),
    [items, rutina],
  );

  const hasSplitGroups = doneOnDay.length > 0 && doneByQuota.length > 0;
  const todayLabel = doneTodayLabel || RUTINA_DONE_GROUP_COPY.doneToday;
  const beforeLabel = doneBeforeLabel || RUTINA_DONE_GROUP_COPY.doneBefore;
  const headingLabel = doneHeadingLabel || RUTINA_DAY_GROUP_COPY.done;

  if (!items.length) return null;

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
      {doneByQuota.length > 0 && renderDoneGroup(doneByQuota, beforeLabel, true, 'before')}
    </Box>
  ) : (
    <RutinaDoneCarousel
      items={items}
      rutina={rutina}
      habitsPreferences={habitsPreferences}
      readOnly={readOnly}
      onToggle={onToggle}
      centerWhenFits={alignIconsLeft || defaultExpanded ? false : undefined}
      // Sin forzar tono de grupo: cada entrada resuelve today/before canónicamente.
      doneTone={null}
    />
  );

  if (shouldCollapse) {
    return (
      <CollapsibleSection
        title={headingLabel}
        count={items.length}
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
      count={items.length}
    >
      {doneContent}
    </CollapseSectionLabel>
  );
}
