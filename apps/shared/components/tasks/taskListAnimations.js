const STYLE_ID = 'task-list-animations';

const STYLES = `
  @keyframes taskListPulse {
    0% { opacity: 1; }
    50% { opacity: 0.7; }
    100% { opacity: 1; }
  }

  @keyframes taskListSubtlePulse {
    0% { opacity: 1; }
    50% { opacity: 0.9; }
    100% { opacity: 1; }
  }
`;

/** Inyecta keyframes de selección múltiple (idempotente). */
export function ensureTaskListAnimations() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const styleSheet = document.createElement('style');
  styleSheet.id = STYLE_ID;
  styleSheet.textContent = STYLES;
  document.head.appendChild(styleSheet);
}
