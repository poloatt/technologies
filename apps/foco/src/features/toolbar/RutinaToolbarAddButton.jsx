import React from 'react';
import TooltipSpan from '@shared/components/TooltipSpan';
import { ToolbarAddButton } from '@shared/components/common/ToolbarAddButton';

export default function RutinaToolbarAddButton({ buttonSx }) {
  return (
    <TooltipSpan title="Agregar hábito">
      <ToolbarAddButton
        buttonSx={buttonSx}
        aria-label="Agregar hábito"
        onClick={() => window.dispatchEvent(new CustomEvent('openAddHabit'))}
      />
    </TooltipSpan>
  );
}

RutinaToolbarAddButton.isButtonComponent = true;
