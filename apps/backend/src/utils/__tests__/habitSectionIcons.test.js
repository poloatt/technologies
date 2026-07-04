import {
  getHabitId,
  habitIdsMatch,
  findHabitIndexInSection,
} from '@shared/habits';

describe('habitSectionIcons id helpers', () => {
  it('matches habit by id or _id', () => {
    const habit = { id: 'agua', _id: '507f1f77bcf86cd799439011', label: 'Agua' };
    expect(habitIdsMatch(habit, 'agua')).toBe(true);
    expect(habitIdsMatch(habit, '507f1f77bcf86cd799439011')).toBe(true);
    expect(getHabitId(habit)).toBe('agua');
  });

  it('finds habit index when request uses _id', () => {
    const habits = [{ id: 'bath', label: 'Ducha' }, { id: 'skin', _id: 'abc123', label: 'Skin' }];
    expect(findHabitIndexInSection(habits, 'abc123')).toBe(1);
  });
});
