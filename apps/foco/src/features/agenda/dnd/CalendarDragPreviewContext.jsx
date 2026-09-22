import React, { createContext, useContext } from 'react';

const CalendarDragPreviewContext = createContext(null);

export function CalendarDragPreviewProvider({ value, children }) {
  return (
    <CalendarDragPreviewContext.Provider value={value}>
      {children}
    </CalendarDragPreviewContext.Provider>
  );
}

export function useCalendarDragPreview() {
  return useContext(CalendarDragPreviewContext);
}
