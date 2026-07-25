const mockRun = jest.fn();

jest.mock('../src/main', () => ({
  run: mockRun,
}));

describe('Action entrypoint', () => {
  it('should invoke run on module load', async () => {
    jest.resetModules();
    await import('../src/index');

    expect(mockRun).toHaveBeenCalledTimes(1);
  });
});
