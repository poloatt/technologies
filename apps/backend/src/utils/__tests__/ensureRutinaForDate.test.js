import { ensureRutinaForDate } from '@foco/features/rutinas/lib/ensureRutinaForDate.js';

const mockGet = jest.fn();
const mockPost = jest.fn();

jest.mock('@shared/config/axios.js', () => ({
  __esModule: true,
  default: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
  },
}));

describe('ensureRutinaForDate', () => {
  const today = new Date('2026-06-22T12:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(today);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns cached rutina from list without network create', async () => {
    const rutinas = [{ _id: 'r1', fecha: '2026-06-22T00:00:00.000Z' }];
    const getRutinaById = jest.fn().mockResolvedValue(rutinas[0]);

    const result = await ensureRutinaForDate(today, {
      rutinas,
      getRutinaById,
      fetchRutinas: jest.fn(),
    });

    expect(result).toEqual(rutinas[0]);
    expect(getRutinaById).toHaveBeenCalledWith('r1');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('creates rutina when verify says it does not exist', async () => {
    mockGet.mockResolvedValue({ data: { exists: false } });
    mockPost.mockResolvedValue({ data: { _id: 'new', fecha: '2026-06-22T00:00:00.000Z' } });

    const getRutinaById = jest.fn().mockResolvedValue({ _id: 'new' });
    const fetchRutinas = jest.fn().mockResolvedValue([]);

    const result = await ensureRutinaForDate(today, {
      rutinas: [],
      getRutinaById,
      fetchRutinas,
    });

    expect(mockPost).toHaveBeenCalledWith('/api/rutinas', {
      fecha: '2026-06-22',
      useGlobalConfig: true,
    });
    expect(fetchRutinas).toHaveBeenCalled();
    expect(result._id).toBe('new');
  });

  it('does not create records for future dates', async () => {
    const future = new Date('2026-06-25T12:00:00.000Z');
    mockGet.mockResolvedValue({ data: { exists: false } });

    const result = await ensureRutinaForDate(future, {
      rutinas: [],
      getRutinaById: jest.fn(),
      fetchRutinas: jest.fn(),
    });

    expect(result).toBeNull();
    expect(mockPost).not.toHaveBeenCalled();
  });
});
