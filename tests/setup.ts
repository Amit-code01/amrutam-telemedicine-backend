process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://amrutam:amrutam_local@localhost:5432/amrutam_test?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'test-only-secret-that-is-at-least-thirty-two-characters-long';
