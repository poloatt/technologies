import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Box, Tabs, Tab, Tooltip, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

export default function HabitsManagerSectionTabs({
  sections = [],
  currentSection,
  onSectionChange,
  showAddForm,
  onAddClick,
}) {
  const tabsRef = useRef(null);
  const tabsContainerRef = useRef(null);
  const [tabsOverflow, setTabsOverflow] = useState(false);

  const measureTabs = useCallback(() => {
    const tabsEl = tabsRef.current;
    const containerEl = tabsContainerRef.current;
    if (!tabsEl || !containerEl) return;
    const flexContainer = tabsEl.querySelector('.MuiTabs-flexContainer');
    if (!flexContainer) return;
    setTabsOverflow(flexContainer.scrollWidth > containerEl.clientWidth + 1);
  }, []);

  useLayoutEffect(() => {
    measureTabs();
  }, [measureTabs, sections, currentSection]);

  useEffect(() => {
    const containerEl = tabsContainerRef.current;
    const tabsEl = tabsRef.current;
    if (!containerEl) return undefined;

    const observer = new ResizeObserver(measureTabs);
    observer.observe(containerEl);
    const flexContainer = tabsEl?.querySelector('.MuiTabs-flexContainer');
    if (flexContainer) observer.observe(flexContainer);

    return () => observer.disconnect();
  }, [measureTabs, sections]);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.default',
        flexShrink: 0,
        width: '100%',
        minHeight: 40,
      }}
    >
      <Box
        ref={tabsContainerRef}
        sx={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          justifyContent: tabsOverflow ? 'flex-start' : 'center',
        }}
      >
        <Tabs
          ref={tabsRef}
          value={currentSection}
          onChange={onSectionChange}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            width: tabsOverflow ? '100%' : 'auto',
            maxWidth: '100%',
            minHeight: 40,
            minWidth: 0,
            '& .MuiTab-root': {
              minHeight: 40,
              py: 1,
              px: 2,
              fontSize: '0.8125rem',
              fontWeight: 600,
              textTransform: 'none',
            },
          }}
        >
          {sections.map((section) => (
            <Tab key={section.value} label={section.label} value={section.value} />
          ))}
        </Tabs>
      </Box>
      {!showAddForm && (
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', pr: 1, flexShrink: 0 }}>
          <Tooltip title="Agregar hábito">
            <IconButton
              size="small"
              onClick={onAddClick}
              aria-label="Agregar hábito"
              sx={{ width: 32, height: 32, color: 'text.secondary' }}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Box>
  );
}
