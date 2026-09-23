import { jest } from '@jest/globals';

const mockFind = jest.fn();
const mockFindOne = jest.fn();
const mockSave = jest.fn();

const taskDoc = (fields) => ({
  ...fields,
  save: mockSave,
});

function MockTareaSeries(data) {
  Object.assign(this, data);
  this.save = mockSave;
}
MockTareaSeries.findOne = mockFindOne;

jest.unstable_mockModule('../../models/index.js', () => ({
  Tareas: {
    find: mockFind,
    parseGoogleDueDate: (due) => {
      if (!due) return null;
      const dt = new Date(due);
      return Number.isNaN(dt.getTime()) ? null : dt;
    },
  },
  TareaSeries: MockTareaSeries,
}));

const { reconcileSeriesFromGoogle } = await import('../googleTasksRecurrenceService.js');

describe('reconcileSeriesFromGoogle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.GTASKS_ASSUME_GOOGLE_RECURRING_SINGLE;
    mockFind.mockResolvedValue([]);
    mockFindOne.mockResolvedValue(null);
    mockSave.mockResolvedValue(undefined);
  });

  test('does not create series for single Google task with only a due date (default)', async () => {
    const due = new Date(2026, 4, 20, 13, 45, 0, 0);
    mockFind.mockResolvedValue([
      taskDoc({
        titulo: 'Pago Monotributo',
        descripcion: '',
        googleTasksSync: { googleTaskId: 'gt-1', googleTaskListId: 'list-1' },
        fechaVencimiento: due,
        fechaInicio: due,
      }),
    ]);

    const stats = await reconcileSeriesFromGoogle(
      'user1',
      'obj1',
      'list-1',
      [{ id: 'gt-1', title: 'Pago Monotributo', due: due.toISOString() }],
    );

    expect(stats.seriesCreated).toBe(0);
    expect(stats.seriesUpdated).toBe(0);
    expect(mockSave).not.toHaveBeenCalled();
  });

  test('creates series from raw Google notes when local descripcion is cleaned', async () => {
    const due = new Date(2026, 4, 21, 13, 45, 0, 0);
    mockFind.mockResolvedValue([
      taskDoc({
        _id: 'local-1',
        titulo: 'ATTA sync',
        descripcion: 'Solo descripción',
        googleTasksSync: { googleTaskId: 'gt-atta', googleTaskListId: 'list-atta' },
        fechaVencimiento: new Date(2026, 4, 21, 12, 0, 0, 0),
        fechaInicio: new Date(2026, 4, 21, 12, 0, 0, 0),
      }),
    ]);

    const stats = await reconcileSeriesFromGoogle(
      'user1',
      'obj-atta',
      'list-atta',
      [
        {
          id: 'gt-atta',
          title: 'ATTA sync',
          notes: 'Solo descripción\n\nSe repite cada semana',
          due: due.toISOString(),
        },
      ],
    );

    expect(stats.seriesCreated).toBe(1);
    expect(mockSave).toHaveBeenCalled();
  });

  test('creates series when notes contain RRULE', async () => {
    const due = new Date(2026, 4, 20, 12, 0, 0, 0);
    mockFind.mockResolvedValue([
      taskDoc({
        titulo: 'ATTA standup',
        descripcion: 'Recurrencia:\nRRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=WE',
        googleTasksSync: { googleTaskId: 'gt-2', googleTaskListId: 'list-atta' },
        fechaVencimiento: due,
        fechaInicio: due,
      }),
    ]);

    const stats = await reconcileSeriesFromGoogle(
      'user1',
      'obj-atta',
      'list-atta',
      [
        {
          id: 'gt-2',
          title: 'ATTA standup',
          notes: 'Recurrencia:\nRRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=WE',
          due: due.toISOString(),
        },
      ],
    );

    expect(stats.seriesCreated).toBe(1);
    expect(mockSave).toHaveBeenCalled();
  });

  test('creates weekly series from googleDueHistory with 2 weekly dues', async () => {
    const due1 = new Date(2026, 4, 13, 12, 0, 0, 0); // Wed
    const due2 = new Date(2026, 4, 20, 12, 0, 0, 0); // Wed
    mockFind.mockResolvedValue([
      taskDoc({
        _id: 'local-hist',
        titulo: 'Brusquettas',
        descripcion: '',
        googleTasksSync: { googleTaskId: 'gt-brus', googleTaskListId: 'list-rutinas' },
        fechaVencimiento: due2,
        fechaInicio: due2,
        googleDueHistory: [due1, due2],
      }),
    ]);

    const stats = await reconcileSeriesFromGoogle(
      'user1',
      'obj-rutinas',
      'list-rutinas',
      [{ id: 'gt-brus', title: 'Brusquettas', due: due2.toISOString() }],
    );

    expect(stats.seriesCreated).toBe(1);
  });

  test('creates series from stored recurrenceHint when notes cleaned', async () => {
    const due = new Date(2026, 4, 21, 12, 0, 0, 0);
    mockFind.mockResolvedValue([
      taskDoc({
        _id: 'local-hint',
        titulo: 'Weekly chore',
        descripcion: 'Solo texto',
        googleTasksSync: {
          googleTaskId: 'gt-hint',
          googleTaskListId: 'list-1',
          recurrenceHint: 'FREQ=WEEKLY;INTERVAL=1',
        },
        fechaVencimiento: due,
        fechaInicio: due,
      }),
    ]);

    const stats = await reconcileSeriesFromGoogle(
      'user1',
      'obj1',
      'list-1',
      [{ id: 'gt-hint', title: 'Weekly chore', due: due.toISOString() }],
    );

    expect(stats.seriesCreated).toBe(1);
  });

  test('creates weekly series for single task when ASSUME env is true', async () => {
    jest.resetModules();
    process.env.GTASKS_ASSUME_GOOGLE_RECURRING_SINGLE = 'true';
    const { reconcileSeriesFromGoogle: reconcileWithAssume } = await import(
      '../googleTasksRecurrenceService.js'
    );

    const due = new Date(2026, 4, 20, 9, 0, 0, 0);
    mockFind.mockResolvedValue([
      taskDoc({
        titulo: 'Weekly review',
        descripcion: '',
        googleTasksSync: { googleTaskId: 'gt-3', googleTaskListId: 'list-1' },
        fechaVencimiento: due,
        fechaInicio: due,
      }),
    ]);

    const stats = await reconcileWithAssume('user1', 'obj1', 'list-1', []);

    expect(stats.seriesCreated).toBe(1);
    delete process.env.GTASKS_ASSUME_GOOGLE_RECURRING_SINGLE;
    jest.resetModules();
    await import('../googleTasksRecurrenceService.js');
  });
});
