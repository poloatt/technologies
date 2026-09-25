import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Box, IconButton, SvgIcon, Typography } from '@mui/material';
import StyleOutlinedIcon from '@mui/icons-material/StyleOutlined';
import { BodyFigure, OrganFigure } from '@shared/components/body';
import { CollapseChevron, SplitScreen } from '@shared/components/common';
import { TareaFormTipoSelector } from '@shared/components/forms/tareaFormUi';
import useResponsive from '@shared/hooks/useResponsive';
import { taskFormHeaderActionIconSx } from '@shared/components/forms/tareaFormTokens';
import { BODY_ZONES, zoneNeedsAttention } from '@shared/pulso';
import { groupBones, isNeckBone } from './boneGroups';
import { MUSCLE_SECTIONS, ORGAN_SECTIONS } from './dataTemplates';
import BoneGroupThumb from './BoneGroupThumb';
import BoneSubgroupDialog, { countPhrase, OrganList, SubgroupBoneList } from './BoneSubgroupDialog';

function BoneIcon(props) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <g fill="currentColor" transform="rotate(-42 12 12)">
        <rect x="6.5" y="10.1" width="11" height="3.8" rx="1.4" />
        <circle cx="6.2" cy="9.4" r="2.35" />
        <circle cx="6.2" cy="14.6" r="2.35" />
        <circle cx="17.8" cy="9.4" r="2.35" />
        <circle cx="17.8" cy="14.6" r="2.35" />
      </g>
    </SvgIcon>
  );
}

const LAYER_OPTIONS = [
  { value: 'huesos', label: 'Huesos' },
  { value: 'musculos', label: 'Músculos' },
  { value: 'organos', label: 'Órganos' },
];

const ZONE_IDS = BODY_ZONES.map((zone) => zone.id);
const BONE_ZONE_LABEL = {
  cabeza: 'Cabeza',
  pecho: 'Tronco',
  brazos: 'Brazos',
  piernas: 'Piernas',
};
const SKELETON_FRAME = 300;
const FOCUS_PARTS = new Set(['mano', 'pie', 'cadera', 'cuello', 'dientes']);
const ZONE_ORDER = ['cabeza', 'pecho', 'brazos', 'piernas'];
const ZONE_BONES = { pecho: ['pecho', 'abdomen'] };
const NamedSkeleton = lazy(() => import('./NamedSkeleton'));

function sectionKey(section) {
  return section.id || section.zone;
}

export default function BodyMap({
  controles = [],
  items = [],
  selectedZone,
  onSelectZone,
}) {
  const { isDesktop } = useResponsive();
  const [layer, setLayer] = useState('musculos');
  const [boneName, setBoneName] = useState('');
  const [boneZone, setBoneZone] = useState(null);
  const [markedGroup, setMarkedGroup] = useState(null);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [groupCardZone, setGroupCardZone] = useState(null);
  const [side, setSide] = useState(null);
  const [focusPart, setFocusPart] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const rowRefs = useRef({});
  const highlights = useMemo(() => {
    const next = {};
    ZONE_IDS.forEach((zoneId) => {
      if (zoneNeedsAttention(zoneId, controles)) next[zoneId] = 'attention';
    });
    if (selectedZone) {
      next[selectedZone] = next[selectedZone] === 'attention' ? 'both' : 'selected';
    }
    return next;
  }, [controles, selectedZone]);

  const sections = useMemo(() => ZONE_ORDER.map((zone) => {
    const names = [...new Set(
      catalog
        .filter((bone) => {
          if (zone === 'pecho') {
            return ZONE_BONES.pecho.includes(bone.zone) || isNeckBone(bone.name);
          }
          if (zone === 'cabeza') return bone.zone === 'cabeza' && !isNeckBone(bone.name);
          return (ZONE_BONES[zone] || [zone]).includes(bone.zone);
        })
        .map((bone) => bone.name)
        .filter((name) => {
          if (!side || (zone !== 'brazos' && zone !== 'piernas')) return true;
          if (/derech/.test(name)) return side === 'r';
          if (/izquierd/.test(name)) return side === 'l';
          return true;
        }),
    )].sort((a, b) => a.localeCompare(b, 'es'));
    return {
      zone,
      label: BONE_ZONE_LABEL[zone],
      groups: groupBones(zone, names),
    };
  }).filter((section) => section.groups.length), [catalog, side]);
  const showThumbs = layer === 'huesos';
  const leafUnit = layer === 'huesos' ? 'huesos' : layer === 'musculos' ? 'músculos' : 'órganos';
  const layerSections = layer === 'huesos'
    ? sections
    : (layer === 'musculos' ? MUSCLE_SECTIONS : ORGAN_SECTIONS);
  const groupCard = layerSections.find((section) => sectionKey(section) === groupCardZone) || null;

  const onZoneClick = (zoneId) => onSelectZone(selectedZone === zoneId ? null : zoneId);
  const showFullSkeleton = () => {
    setBoneName('');
    setBoneZone(null);
    setMarkedGroup(null);
    setExpandedGroup(null);
    setGroupCardZone(null);
    setSide(null);
    setFocusPart(null);
    onSelectZone(null);
  };

  const chooseZone = (zone) => {
    setBoneZone(zone.zone);
    setBoneName('');
    setMarkedGroup(null);
    setSide(null);
    setFocusPart(FOCUS_PARTS.has(zone.groupId) ? zone.groupId : null);
    setMarkedGroup(zone.groupId || null);
    setExpandedGroup((current) => (current === zone.zone ? current : null));
    onSelectZone(zone.clinicalZone);
  };

  const chooseGroup = (zone, groupId) => {
    chooseZone({
      zone,
      groupId: FOCUS_PARTS.has(groupId) ? groupId : null,
      clinicalZone: groupId === 'abdomen' ? 'abdomen' : zone,
    });
    setMarkedGroup(groupId);
  };

  const chooseBone = (bone) => {
    const parentZone = bone.zone === 'abdomen' || isNeckBone(bone.name) ? 'pecho' : bone.zone;
    const owner = groupBones(parentZone, [bone.name])[0];
    const boneSide = /derech/.test(bone.name) ? 'r' : /izquierd/.test(bone.name) ? 'l' : null;
    setBoneZone(parentZone);
    setBoneName(bone.name);
    setMarkedGroup(owner?.id || null);
    setSide(parentZone === 'brazos' || parentZone === 'piernas' ? boneSide : null);
    setFocusPart(['mano', 'pie', 'cadera', 'cuello', 'dientes'].includes(owner?.id) ? owner.id : null);
    setExpandedGroup((current) => (current === parentZone ? current : null));
    onSelectZone(
      bone.zone === 'abdomen' ? 'abdomen' : isNeckBone(bone.name) ? 'pecho' : bone.clinicalZone,
    );
  };

  useEffect(() => {
    const key = markedGroup ? `${boneZone}:${markedGroup}` : boneZone;
    rowRefs.current[key]?.scrollIntoView({ block: 'nearest' });
  }, [boneZone, markedGroup]);

  const focusSection = (section) => {
    if (layer === 'huesos') {
      chooseZone({
        zone: section.zone,
        groupId: null,
        clinicalZone: section.zone,
      });
    } else {
      setBoneName('');
      setBoneZone(sectionKey(section));
      setMarkedGroup(null);
      setSide(null);
      setFocusPart(null);
      setExpandedGroup((current) => (current === sectionKey(section) ? current : null));
      onSelectZone(section.zone);
    }
  };

  const openSection = (section) => {
    focusSection(section);
    setGroupCardZone(sectionKey(section));
  };

  const groupCardPanel = groupCard ? (
    <BoneSubgroupDialog
      embedded={isDesktop}
      open
      subgroup={{ label: groupCard.label }}
      zone={groupCard.zone}
      controles={controles}
      items={items}
      groups={groupCard.groups || []}
      organs={groupCard.organs || null}
      boneName={boneName}
      showThumbs={showThumbs}
      leafUnit={leafUnit}
      onClose={() => setGroupCardZone(null)}
      onGroupClick={(groupId) => {
        if (layer === 'huesos') chooseGroup(groupCard.zone, groupId);
        else setMarkedGroup(groupId);
      }}
      onBoneClick={(name) => {
        if (layer === 'huesos') {
          chooseBone({
            name,
            zone: groupCard.zone,
            clinicalZone: groupCard.zone,
          });
        } else if (groupCard.organs) {
          setBoneName(name);
          setMarkedGroup(name);
        } else {
          setBoneName(name);
        }
      }}
    />
  ) : null;

  const showSidePills = layer === 'huesos' && (boneZone === 'brazos' || boneZone === 'piernas');

  const layerSelector = (
    <TareaFormTipoSelector
      value={layer}
      onChange={(value) => {
        setLayer(value);
        setBoneName('');
        setBoneZone(null);
        setMarkedGroup(null);
        setExpandedGroup(null);
        setGroupCardZone(null);
        setSide(null);
        setFocusPart(null);
      }}
      options={LAYER_OPTIONS}
      sx={{ width: '100%' }}
    />
  );

  const mapColumn = (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 1, width: '100%' }}>
      {!isDesktop && (
        <Box sx={{ width: '100%', mb: 1 }}>
          {layerSelector}
        </Box>
      )}
      {layer === 'musculos' && (
        <BodyFigure highlights={highlights} onZoneClick={onZoneClick} />
      )}
      {layer === 'huesos' && (
        <Suspense fallback={<Typography variant="caption">Cargando esqueleto…</Typography>}>
          <NamedSkeleton
            height={SKELETON_FRAME}
            highlights={highlights}
            activeBone={boneName}
            focusZone={boneZone}
            focusSide={side}
            focusPart={focusPart}
            focusGroup={markedGroup}
            onCatalog={setCatalog}
            onBoneClick={chooseBone}
            onZonePick={chooseZone}
            onZoomOut={showFullSkeleton}
          />
        </Suspense>
      )}
      {layer === 'organos' && (
        <OrganFigure
          highlights={highlights}
          onZoneClick={onZoneClick}
          showOrgans
        />
      )}
      {layerSections.length > 0 && (
        <Box sx={{ width: '100%', mt: 1, alignSelf: 'stretch' }}>
          {layer === 'huesos' && (
            <Box
              aria-hidden={!showSidePills}
              inert={showSidePills ? undefined : ''}
              sx={{
                mb: 1,
                px: 1,
                visibility: showSidePills ? 'visible' : 'hidden',
                pointerEvents: showSidePills ? 'auto' : 'none',
              }}
            >
              <TareaFormTipoSelector
                value={side || ''}
                onChange={setSide}
                options={[
                  { value: 'l', label: 'Izquierdo' },
                  { value: 'r', label: 'Derecho' },
                ]}
                sx={{ width: '100%' }}
              />
            </Box>
          )}
          {layerSections.map((section) => {
            const key = sectionKey(section);
            const open = expandedGroup === key;
            const names = (section.groups || []).flatMap((group) => group.bones);
            const caption = section.organs
              ? countPhrase(section.organs.length, 'órganos')
              : (section.groups.length > 1 ? `${section.groups.length} grupos` : null);
            const expandLabel = section.organs ? 'órganos' : 'subgrupos';
            const marked = groupCardZone === key || boneZone === key;
            return (
              <Box
                key={key}
                ref={(node) => { rowRefs.current[key] = node; }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    width: '100%',
                    alignItems: 'center',
                    gap: 1,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    bgcolor: marked ? 'action.selected' : 'transparent',
                    color: 'text.primary',
                    px: 1,
                  }}
                >
                  <Box
                    component="button"
                    type="button"
                    aria-pressed={marked}
                    onClick={() => (isDesktop ? openSection(section) : focusSection(section))}
                    sx={{
                      display: 'flex',
                      flex: 1,
                      minWidth: 0,
                      textAlign: 'left',
                      alignItems: 'baseline',
                      gap: 1,
                      border: 0,
                      bgcolor: 'transparent',
                      color: 'inherit',
                      py: 1,
                      px: 0.5,
                      cursor: 'pointer',
                      font: 'inherit',
                    }}
                  >
                    {showThumbs ? <BoneGroupThumb zone={section.zone} names={names} /> : null}
                    <Typography variant="body2" component="span" color="inherit">
                      {section.label}
                    </Typography>
                    {caption && (
                      <Typography variant="caption" component="span" color="text.secondary">
                        {caption}
                      </Typography>
                    )}
                  </Box>
                  {!isDesktop && (
                    <IconButton
                      size="small"
                      aria-label={`Info de ${section.label}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        openSection(section);
                      }}
                      sx={taskFormHeaderActionIconSx()}
                    >
                      <StyleOutlinedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  )}
                  {showThumbs ? (
                    <IconButton
                      size="small"
                      aria-label={open ? `Cerrar ${section.label}` : `Ver ${expandLabel} de ${section.label}`}
                      aria-expanded={open}
                      onClick={(event) => {
                        event.stopPropagation();
                        setExpandedGroup(open ? null : key);
                      }}
                      sx={taskFormHeaderActionIconSx(open ? 'primary.main' : 'text.secondary')}
                    >
                      <BoneIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  ) : (
                    <CollapseChevron
                      asButton
                      expanded={open}
                      aria-label={open ? `Cerrar ${section.label}` : `Ver ${expandLabel} de ${section.label}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setExpandedGroup(open ? null : key);
                      }}
                    />
                  )}
                </Box>
                {open && (section.organs ? (
                  <OrganList
                    organs={section.organs}
                    selectedId={boneZone === key ? markedGroup : null}
                    onSelect={(organId) => {
                      setBoneZone(key);
                      setMarkedGroup(organId);
                      setBoneName(organId);
                      onSelectZone(section.zone);
                      if (isDesktop) setGroupCardZone(key);
                    }}
                  />
                ) : (
                  <SubgroupBoneList
                    key={key}
                    zone={section.zone}
                    groups={section.groups}
                    selectedGroupId={boneZone === key ? markedGroup : null}
                    showThumbs={showThumbs}
                    leafUnit={leafUnit}
                    onSelectGroup={(groupId) => {
                      if (layer === 'huesos') chooseGroup(section.zone, groupId);
                      else {
                        setBoneZone(key);
                        setMarkedGroup(groupId);
                        onSelectZone(section.zone);
                      }
                      if (isDesktop) setGroupCardZone(key);
                    }}
                  />
                ))}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );

  if (isDesktop) {
    return (
      <Box sx={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ width: '50%', mx: 'auto', flexShrink: 0, py: 1 }}>
          {layerSelector}
        </Box>
        <SplitScreen
          sx={{ flex: 1, minHeight: 0 }}
          start={(
            <Box sx={{ overflowX: 'hidden', overflowY: 'auto', height: '100%', minHeight: 0 }}>
              {mapColumn}
            </Box>
          )}
          detail={groupCardPanel || <Box sx={{ height: '100%' }} />}
        />
      </Box>
    );
  }

  return (
    <>
      {mapColumn}
      {groupCardPanel}
    </>
  );
}
