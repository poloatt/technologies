import React, { createContext, useContext } from 'react';

const DietHabitCaptionContext = createContext({});

export function DietHabitCaptionProvider({ captions, children }) {
  return (
    <DietHabitCaptionContext.Provider value={captions || {}}>
      {children}
    </DietHabitCaptionContext.Provider>
  );
}

export function useDietHabitCaption(section, habitId) {
  const captions = useContext(DietHabitCaptionContext);
  if (!section || !habitId) return '';
  return captions?.[section]?.[habitId] || '';
}

export function useDietHabitCaptionsMap() {
  return useContext(DietHabitCaptionContext);
}
