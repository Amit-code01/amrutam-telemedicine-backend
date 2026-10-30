export const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'Amrutam Telemedicine API',
    version: '1.0.0',
    description: 'REST API for telemedicine consultations.',
  },
  servers: [{ url: '/' }],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      RegisterRequest: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 12, maxLength: 128 },
          role: { type: 'string', enum: ['PATIENT', 'DOCTOR'] },
          fullName: { type: 'string', minLength: 2, maxLength: 160 },
          specialty: { type: 'string', maxLength: 100 },
        },
        required: ['email', 'password', 'role', 'fullName'],
      },
      LoginRequest: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
          mfaCode: { type: 'string', minLength: 6, maxLength: 6 },
        },
        required: ['email', 'password'],
      },
      TokenPair: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
          tokenType: { type: 'string', example: 'Bearer' },
        },
        required: ['accessToken', 'refreshToken', 'tokenType'],
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              requestId: { type: 'string' },
            },
            required: ['code', 'message'],
          },
        },
        required: ['error'],
      },
      BookingRequest: {
        type: 'object',
        properties: {
          slotId: { type: 'string', format: 'uuid' },
          reason: { type: 'string', maxLength: 1000 },
        },
        required: ['slotId'],
      },
      AvailabilityRequest: {
        type: 'object',
        properties: {
          startsAt: { type: 'string', format: 'date-time' },
          endsAt: { type: 'string', format: 'date-time' },
          timezone: { type: 'string', example: 'Asia/Kolkata' },
        },
        required: ['startsAt', 'endsAt'],
      },
      StatusRequest: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] },
        },
        required: ['status'],
      },
      PrescriptionRequest: {
        type: 'object',
        properties: { content: { type: 'object', additionalProperties: true } },
        required: ['content'],
      },
      RefreshRequest: {
        type: 'object',
        properties: { refreshToken: { type: 'string' } },
        required: ['refreshToken'],
      },
      MfaConfirmRequest: {
        type: 'object',
        properties: { code: { type: 'string', minLength: 6, maxLength: 6 } },
        required: ['code'],
      },
      DoctorProfileUpdate: {
        type: 'object',
        properties: {
          fullName: { type: 'string', minLength: 2, maxLength: 160 },
          specialty: { type: 'string', maxLength: 100 },
          bio: { type: 'string', maxLength: 2000 },
          consultationFee: { type: 'integer', minimum: 0, maximum: 1000000 },
        },
      },
      PatientProfileUpdate: {
        type: 'object',
        properties: {
          fullName: { type: 'string', minLength: 2, maxLength: 160 },
          phone: { type: 'string', maxLength: 32 },
          dateOfBirth: { type: 'string', format: 'date-time' },
        },
      },
      Error: {
        $ref: '#/components/schemas/ErrorResponse',
      },
    },
  },
  paths: {
    '/api/v1/auth/register': {
      post: {
        summary: 'Register patient or doctor',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } } },
        },
        responses: {
          '201': { description: 'Registered' },
          '400': { description: 'Invalid input' },
          '409': { description: 'Email already used' },
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        summary: 'Login; provide MFA code when enabled',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
        },
        responses: {
          '200': { description: 'Session tokens' },
          '401': { description: 'Invalid credentials' },
        },
      },
    },
    '/api/v1/auth/refresh': {
      post: {
        summary: 'Rotate refresh token',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RefreshRequest' } } },
        },
        responses: {
          '200': { description: 'New token pair' },
          '401': { description: 'Expired or revoked refresh token' },
        },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        security: [{ bearerAuth: [] }],
        summary: 'Revoke refresh token',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RefreshRequest' } } },
        },
        responses: { '204': { description: 'Logged out' } },
      },
    },
    '/api/v1/auth/mfa/setup': {
      post: {
        security: [{ bearerAuth: [] }],
        summary: 'Start TOTP MFA enrollment',
        responses: { '200': { description: 'Secret and otpauth URL; handle as a secret' } },
      },
    },
    '/api/v1/auth/mfa/confirm': {
      post: {
        security: [{ bearerAuth: [] }],
        summary: 'Confirm TOTP MFA enrollment',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/MfaConfirmRequest' } } },
        },
        responses: { '204': { description: 'MFA enabled' } },
      },
    },
    '/api/v1/users/me': {
      get: {
        security: [{ bearerAuth: [] }],
        summary: 'Get own profile',
        responses: { '200': { description: 'Profile' } },
      },
      patch: {
        security: [{ bearerAuth: [] }],
        summary: 'Update own profile',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  { $ref: '#/components/schemas/PatientProfileUpdate' },
                  { $ref: '#/components/schemas/DoctorProfileUpdate' },
                ],
              },
            },
          },
        },
        responses: { '200': { description: 'Updated profile' } },
      },
    },
    '/api/v1/doctors': {
      get: {
        summary: 'Search verified doctors (q, specialty, page, pageSize)',
        parameters: [
          { in: 'query', name: 'q', schema: { type: 'string', maxLength: 100 } },
          { in: 'query', name: 'specialty', schema: { type: 'string' } },
          { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1, default: 1 } },
          {
            in: 'query',
            name: 'pageSize',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        ],
        responses: { '200': { description: 'Paginated doctors' } },
      },
    },
    '/api/v1/doctors/{id}/availability': {
      get: {
        summary: 'List bookable slots (from, to ISO dates)',
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          { in: 'query', name: 'from', required: true, schema: { type: 'string', format: 'date-time' } },
          { in: 'query', name: 'to', required: true, schema: { type: 'string', format: 'date-time' } },
        ],
        responses: { '200': { description: 'Availability slots' } },
      },
    },
    '/api/v1/doctors/me': {
      patch: {
        security: [{ bearerAuth: [] }],
        summary: 'Update doctor profile',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/DoctorProfileUpdate' } } },
        },
        responses: { '200': { description: 'Updated profile' } },
      },
    },
    '/api/v1/availability': {
      post: {
        security: [{ bearerAuth: [] }],
        summary: 'Create a doctor availability slot',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/AvailabilityRequest' } } },
        },
        responses: { '201': { description: 'Created slot' }, '409': { description: 'Conflict' } },
      },
    },
    '/api/v1/availability/{id}': {
      delete: {
        security: [{ bearerAuth: [] }],
        summary: 'Deactivate an unbooked slot',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '204': { description: 'Removed' } },
      },
    },
    '/api/v1/consultations': {
      get: {
        security: [{ bearerAuth: [] }],
        summary: 'List own consultations (admin sees all)',
        responses: { '200': { description: 'Paginated consultations' } },
      },
      post: {
        security: [{ bearerAuth: [] }],
        summary: 'Book slot; requires Idempotency-Key header',
        parameters: [
          {
            in: 'header',
            name: 'Idempotency-Key',
            required: true,
            schema: { type: 'string', maxLength: 128 },
          },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/BookingRequest' } } },
        },
        responses: {
          '201': { description: 'Consultation booked' },
          '409': { description: 'Slot or key conflict' },
        },
      },
    },
    '/api/v1/consultations/{id}': {
      get: {
        security: [{ bearerAuth: [] }],
        summary: 'Get authorized consultation',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Consultation' }, '403': { description: 'Not authorized' } },
      },
    },
    '/api/v1/consultations/{id}/status': {
      patch: {
        security: [{ bearerAuth: [] }],
        summary: 'Transition consultation status',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/StatusRequest' } } },
        },
        responses: { '200': { description: 'Updated status' }, '400': { description: 'Invalid transition' } },
      },
    },
    '/api/v1/consultations/{id}/prescriptions': {
      post: {
        security: [{ bearerAuth: [] }],
        summary: 'Doctor creates prescription',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/PrescriptionRequest' } } },
        },
        responses: { '201': { description: 'Prescription created' } },
      },
      get: {
        security: [{ bearerAuth: [] }],
        summary: 'Get authorized prescription',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Prescription' } },
      },
    },
    '/api/v1/admin/analytics': {
      get: {
        security: [{ bearerAuth: [] }],
        summary: 'Admin consultation analytics',
        responses: { '200': { description: 'Counts by status' }, '403': { description: 'Admin only' } },
      },
    },
    '/api/v1/admin/audit-logs': {
      get: {
        security: [{ bearerAuth: [] }],
        summary: 'Admin audit log search',
        responses: { '200': { description: 'Paginated logs' } },
      },
    },
    '/api/v1/admin/doctors/{id}/verification': {
      patch: {
        security: [{ bearerAuth: [] }],
        summary: 'Verify or unverify doctor',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { verified: { type: 'boolean' } },
                required: ['verified'],
              },
            },
          },
        },
        responses: { '200': { description: 'Verification changed' } },
      },
    },
    '/health': { get: { summary: 'Liveness check', responses: { '200': { description: 'Alive' } } } },
    '/ready': {
      get: {
        summary: 'Readiness check (database)',
        responses: { '200': { description: 'Ready' }, '503': { description: 'Not ready' } },
      },
    },
    '/metrics': { get: { summary: 'Prometheus metrics', responses: { '200': { description: 'Metrics' } } } },
  },
} as const;
