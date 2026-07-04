import React from 'react';

import { Box, Typography } from '@mui/material';

import ChecklistItem from './ChecklistItem';

import { RUTINA_DAY_GROUP_COPY } from '@shared/copy/agendaTerminology';

import { isHabitCompletedForHistorial } from '@shared/habits';



const GROUP_HEADING_SX = {

  px: 0.5,

  py: 0.75,

  fontWeight: 600,

  color: 'text.secondary',

  textTransform: 'uppercase',

  letterSpacing: '0.06em',

  fontSize: '0.7rem',

};



function HabitRows({

  items,

  section,

  rutina,

  readOnly,

  onItemClick,

  onEditHabit,

  localData,

}) {

  if (!items.length) return null;



  return items.map((entry) => {

    const { itemId, Icon, label, config, userHabit } = entry;

    const itemValue = localData?.[itemId] !== undefined

      ? localData[itemId]

      : rutina?.[section]?.[itemId];

    const isCompleted = isHabitCompletedForHistorial(itemValue);



    return (

      <Box key={itemId} id={`habit-row-${itemId}`}>

        <ChecklistItem

          itemId={itemId}

          section={section}

          Icon={Icon}

          isCompleted={isCompleted}

          completionValue={itemValue}

          readOnly={readOnly}

          onItemClick={onItemClick}

          config={config}

          habitLabel={label}

          isCustomHabit={Boolean(userHabit)}

          localData={localData}

          onEditHabit={userHabit && onEditHabit ? () => onEditHabit(userHabit, section) : undefined}

        />

      </Box>

    );

  });

}



/**

 * Listado agrupado: Hoy y No toca hoy (orden fijo dentro de cada grupo).

 */

export default function RutinaDayGroupList({

  today = [],

  notToday = [],

  section,

  rutina,

  readOnly = false,

  onItemClick,

  onEditHabit,

  localData = null,

}) {

  const hasToday = today.length > 0;



  return (

    <>

      {hasToday && (

        <Box>

          <Typography variant="caption" sx={GROUP_HEADING_SX}>

            {RUTINA_DAY_GROUP_COPY.today}

          </Typography>

          <HabitRows

            items={today}

            section={section}

            rutina={rutina}

            readOnly={readOnly}

            onItemClick={onItemClick}

            onEditHabit={onEditHabit}

            localData={localData}

          />

        </Box>

      )}

      {notToday.length > 0 && (

        <Box>

          <Typography variant="caption" sx={GROUP_HEADING_SX}>

            {RUTINA_DAY_GROUP_COPY.notToday}

          </Typography>

          <HabitRows

            items={notToday}

            section={section}

            rutina={rutina}

            readOnly={readOnly}

            onItemClick={onItemClick}

            onEditHabit={onEditHabit}

            localData={localData}

          />

        </Box>

      )}

    </>

  );

}


