import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Box, IconButton, SvgIcon, Typography } from '@mui/material';
import StyleOutlinedIcon from '@mui/icons-material/StyleOutlined';
import { BodyFigure, OrganFigure } from '@shared/components/body';
import { TareaFormTipoSelector } from '@shared/components/forms/tareaFormUi';
import { taskFormHeaderActionIconSx } from '@shared/components/forms/tareaFormTokens';
import { BODY_ZONES, zoneNeedsAttention } from '@shared/pulso';
import { groupBones } from './boneGroups';
import BoneGroupThumb from './BoneGroupThumb';
import BoneSubgroupDialog, { SubgroupBoneList } from './BoneSubgroupDialog';

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

export default function BodyMap({ controles = [], items = [], selectedZone, onSelectZone }) {
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

  const selectedZoneLabel = BODY_ZONES.find((zone) => zone.id === selectedZone)?.label;
  const sections = useMemo(() => ZONE_ORDER.map((zone) => {
    const names = [...new Set(
      catalog
        .filter((bone) => (ZONE_BONES[zone] || [zone]).includes(bone.zone))
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
  const groupCard = sections.find((section) => section.zone === groupCardZone) || null;

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
    const parentZone = bone.zone === 'abdomen' ? 'pecho' : bone.zone;
    const owner = groupBones(parentZone, [bone.name])[0];
    const boneSide = /derech/.test(bone.name) ? 'r' : /izquierd/.test(bone.name) ? 'l' : null;
    setBoneZone(parentZone);
    setBoneName(bone.name);
    setMarkedGroup(owner?.id || null);
    setSide(parentZone === 'brazos' || parentZone === 'piernas' ? boneSide : null);
    setFocusPart(['mano', 'pie', 'cadera', 'cuello', 'dientes'].includes(owner?.id) ? owner.id : null);
    setExpandedGroup((current) => (current === parentZone ? current : null));
    onSelectZone(bone.zone === 'abdomen' ? 'abdomen' : bone.clinicalZone);
  };

  useEffect(() => {
    const key = markedGroup ? `${boneZone}:${markedGroup}` : boneZone;
    rowRefs.current[key]?.scrollIntoView({ block: 'nearest' });
  }, [boneZone, markedGroup]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 1, width: '100%' }}>
      <TareaFormTipoSelector
        value={layer}
        onChange={(value) => {
          setLayer(value);
          if (value !== 'huesos') {
            setBoneName('');
            setBoneZone(null);
            setMarkedGroup(null);
            setExpandedGroup(null);
            setGroupCardZone(null);
            setSide(null);
            setFocusPart(null);
          }
        }}
        options={LAYER_OPTIONS}
        sx={{ mb: 1 }}
      />
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
      {layer === 'huesos' && (
        <Box sx={{ width: '100%', mt: 1, alignSelf: 'stretch' }}>
          {(boneZone === 'brazos' || boneZone === 'piernas') && (
            <TareaFormTipoSelector
              value={side || ''}
              onChange={setSide}
              options={[
                { value: 'l', label: 'Izquierdo' },
                { value: 'r', label: 'Derecho' },
              ]}
              sx={{ mb: 1 }}
            />
          )}
          {sections.map((section) => {
            const open = expandedGroup === section.zone;
            const names = section.groups.flatMap((group) => group.bones);
            const marked = boneZone === section.zone;
            return (
              <Box
                key={section.zone}
                ref={(node) => { rowRefs.current[section.zone] = node; }}
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
                  }}
                >
                  <Box
                    component="button"
                    type="button"
                    aria-pressed={marked}
                    onClick={() => chooseZone({
                      zone: section.zone,
                      groupId: null,
                      clinicalZone: section.zone,
                    })}
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
                    <BoneGroupThumb zone={section.zone} names={names} />
                    <Typography variant="body2" component="span" color="inherit">
                      {section.label}
                    </Typography>
                    <Typography variant="caption" component="span" color="text.secondary">
                      {section.groups.length} grupos
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    aria-label={`Info de ${section.label}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setGroupCardZone(section.zone);
                    }}
                    sx={taskFormHeaderActionIconSx()}
                  >
                    <StyleOutlinedIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label={open ? `Cerrar ${section.label}` : `Ver subgrupos de ${section.label}`}
                    aria-expanded={open}
                    onClick={(event) => {
                      event.stopPropagation();
                      setExpandedGroup(open ? null : section.zone);
                    }}
                    sx={taskFormHeaderActionIconSx(open ? 'primary.main' : 'text.secondary')}
                  >
                    <BoneIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Box>
                {open && (
                  <SubgroupBoneList
                    key={section.zone}
                    zone={section.zone}
                    groups={section.groups}
                    selectedGroupId={boneZone === section.zone ? markedGroup : null}
                    onSelectGroup={(groupId) => chooseGroup(section.zone, groupId)}
                  />
                )}
              </Box>
            );
          })}
        </Box>
      )}
      <BoneSubgroupDialog
        open={Boolean(groupCard)}
        subgroup={{ label: groupCard?.label }}
        zone={groupCard?.zone}
        controles={controles}
        items={items}
        groups={groupCard?.groups || []}
        boneName={boneName}
        onClose={() => setGroupCardZone(null)}
        onGroupClick={(groupId) => chooseGroup(groupCard.zone, groupId)}
        onBoneClick={(name) => chooseBone({
          name,
          zone: groupCard.zone,
          clinicalZone: groupCard.zone,
        })}
      />
      {layer !== 'huesos' && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, textAlign: 'center' }}>
          {selectedZoneLabel || 'Tocá una zona para ver solo esa'}
        </Typography>
      )}
    </Box>
  );
}
