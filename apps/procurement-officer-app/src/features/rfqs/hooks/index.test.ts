describe('rfqs hooks index', () => {
  it('module can be imported', async () => {
    const mod = await import('./index');
    expect(mod).toBeDefined();
  });
});
