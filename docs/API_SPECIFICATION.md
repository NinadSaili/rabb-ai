# API specification

Generated from `packages/contracts` by `pnpm docs:api`. Do not edit by hand.

## Conventions

- Base path `/v1` on Supabase Edge Functions. JSON over HTTPS.
- Authentication: `Authorization: Bearer <Supabase JWT>` (anonymous sessions are valid). The webhook uses its own secret.
- Every mutation carries `idempotency_key` (UUID v4). A retry returns the original result with `replayed: true`. Reusing a key with a different payload returns 409 `idempotency_key_reuse`.
- Server time is authoritative. `client_timestamp` is diagnostic only and never used for logic.
- Per user rate limits apply to every endpoint (429 `rate_limited`).
- Request bodies and responses are validated with Zod. Unknown fields in requests are rejected.
- Logs carry the request id and never carry request bodies, prayer text, journal text, tutor messages or app identities.

### Error envelope

```json
{
  "type": "object",
  "properties": {
    "error": {
      "type": "object",
      "properties": {
        "code": {
          "type": "string",
          "enum": [
            "unauthenticated",
            "forbidden",
            "validation_failed",
            "not_found",
            "conflict",
            "idempotency_key_reuse",
            "rate_limited",
            "quota_exceeded",
            "premium_required",
            "feature_disabled",
            "timer_invalid",
            "illegal_transition",
            "internal"
          ]
        },
        "message": {
          "type": "string"
        },
        "request_id": {
          "type": "string"
        }
      },
      "required": [
        "code",
        "message",
        "request_id"
      ],
      "additionalProperties": false
    }
  },
  "required": [
    "error"
  ],
  "additionalProperties": false
}
```

Error codes: `unauthenticated`, `forbidden`, `validation_failed`, `not_found`, `conflict`, `idempotency_key_reuse`, `rate_limited`, `quota_exceeded`, `premium_required`, `feature_disabled`, `timer_invalid`, `illegal_transition`, `internal`.

## Endpoints

### GET /v1/daily/ritual

Today's verse, prayer, timer and session state for the user's local ritual date.

- Auth: JWT
- Errors: `unauthenticated`, `validation_failed`, `rate_limited`, `internal`, `not_found`

Query parameters:

```json
{
  "type": "object",
  "properties": {
    "schedule_id": {
      "type": "string",
      "format": "uuid"
    },
    "translation": {
      "type": "string",
      "minLength": 2,
      "maxLength": 12
    },
    "prefetch_days": {
      "type": "integer",
      "minimum": 0,
      "maximum": 7,
      "default": 7
    }
  },
  "additionalProperties": false
}
```

Response 200:

```json
{
  "type": "object",
  "properties": {
    "local_date": {
      "type": "string",
      "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
    },
    "timezone": {
      "type": "string"
    },
    "days": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "local_date": {
            "type": "string",
            "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
          },
          "verse": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "format": "uuid"
              },
              "reference": {
                "type": "object",
                "properties": {
                  "book": {
                    "type": "string",
                    "pattern": "^[1-3A-Z]{3}$"
                  },
                  "chapter": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 150
                  },
                  "verse_start": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 176
                  },
                  "verse_end": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 176
                  }
                },
                "required": [
                  "book",
                  "chapter",
                  "verse_start"
                ],
                "additionalProperties": false
              },
              "text": {
                "type": "string"
              },
              "translation": {
                "type": "object",
                "properties": {
                  "code": {
                    "type": "string",
                    "minLength": 2,
                    "maxLength": 12
                  },
                  "name": {
                    "type": "string"
                  },
                  "language": {
                    "type": "string",
                    "minLength": 2,
                    "maxLength": 8
                  },
                  "license_name": {
                    "type": "string"
                  },
                  "copyright_text": {
                    "type": "string"
                  },
                  "attribution_text": {
                    "type": "string"
                  }
                },
                "required": [
                  "code",
                  "name",
                  "language",
                  "license_name",
                  "copyright_text",
                  "attribution_text"
                ],
                "additionalProperties": false
              },
              "theme": {
                "type": [
                  "string",
                  "null"
                ]
              }
            },
            "required": [
              "id",
              "reference",
              "text",
              "translation",
              "theme"
            ],
            "additionalProperties": false
          },
          "prayer": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "format": "uuid"
              },
              "title": {
                "type": "string"
              },
              "body": {
                "type": "string"
              },
              "language": {
                "type": "string"
              }
            },
            "required": [
              "id",
              "title",
              "body",
              "language"
            ],
            "additionalProperties": false
          }
        },
        "required": [
          "local_date",
          "verse",
          "prayer"
        ],
        "additionalProperties": false
      },
      "minItems": 1,
      "maxItems": 8
    },
    "schedule_id": {
      "anyOf": [
        {
          "type": "string",
          "format": "uuid"
        },
        {
          "type": "null"
        }
      ]
    },
    "timer_seconds": {
      "anyOf": [
        {
          "type": "integer",
          "exclusiveMinimum": 0
        },
        {
          "type": "null"
        }
      ]
    },
    "session": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid"
            },
            "status": {
              "type": "string",
              "enum": [
                "in_progress",
                "completed",
                "abandoned",
                "expired"
              ]
            },
            "completed_steps": {
              "type": "array",
              "items": {
                "type": "string",
                "enum": [
                  "scripture",
                  "prayer",
                  "timer"
                ]
              }
            }
          },
          "required": [
            "id",
            "status",
            "completed_steps"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
    },
    "server_time": {
      "type": "string",
      "format": "date-time"
    }
  },
  "required": [
    "local_date",
    "timezone",
    "days",
    "schedule_id",
    "timer_seconds",
    "session",
    "server_time"
  ],
  "additionalProperties": false
}
```

### POST /v1/ritual/start

Start a ritual session bound to the server computed local date.

- Auth: JWT
- Errors: `unauthenticated`, `validation_failed`, `rate_limited`, `internal`, `not_found`, `conflict`, `idempotency_key_reuse`

Request body:

```json
{
  "type": "object",
  "properties": {
    "schedule_id": {
      "type": "string",
      "format": "uuid"
    },
    "session_id": {
      "type": "string",
      "format": "uuid"
    },
    "idempotency_key": {
      "type": "string",
      "format": "uuid"
    },
    "client_timestamp": {
      "type": "string",
      "format": "date-time"
    }
  },
  "required": [
    "schedule_id",
    "idempotency_key"
  ],
  "additionalProperties": false
}
```

Response 200:

```json
{
  "type": "object",
  "properties": {
    "session_id": {
      "type": "string",
      "format": "uuid"
    },
    "local_date": {
      "type": "string",
      "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
    },
    "status": {
      "type": "string",
      "enum": [
        "in_progress",
        "completed",
        "abandoned",
        "expired"
      ]
    },
    "timer_seconds": {
      "anyOf": [
        {
          "type": "integer",
          "exclusiveMinimum": 0
        },
        {
          "type": "null"
        }
      ]
    },
    "replayed": {
      "type": "boolean"
    }
  },
  "required": [
    "session_id",
    "local_date",
    "status",
    "timer_seconds",
    "replayed"
  ],
  "additionalProperties": false
}
```

### POST /v1/ritual/complete-step

Record scripture, prayer or timer completion. Timer steps are validated against server time.

- Auth: JWT
- Errors: `unauthenticated`, `validation_failed`, `rate_limited`, `internal`, `not_found`, `timer_invalid`, `illegal_transition`, `idempotency_key_reuse`

Request body:

```json
{
  "type": "object",
  "properties": {
    "session_id": {
      "type": "string",
      "format": "uuid"
    },
    "step_type": {
      "type": "string",
      "enum": [
        "scripture",
        "prayer",
        "timer"
      ]
    },
    "idempotency_key": {
      "type": "string",
      "format": "uuid"
    },
    "monotonic_ms": {
      "type": "integer",
      "minimum": 0,
      "maximum": 86400000
    },
    "offline_queued": {
      "type": "boolean",
      "default": false
    },
    "client_timestamp": {
      "type": "string",
      "format": "date-time"
    }
  },
  "required": [
    "session_id",
    "step_type",
    "idempotency_key"
  ],
  "additionalProperties": false
}
```

Response 200:

```json
{
  "type": "object",
  "properties": {
    "session_id": {
      "type": "string",
      "format": "uuid"
    },
    "step_type": {
      "type": "string",
      "enum": [
        "scripture",
        "prayer",
        "timer"
      ]
    },
    "completed_steps": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": [
          "scripture",
          "prayer",
          "timer"
        ]
      }
    },
    "timer_verified": {
      "type": [
        "boolean",
        "null"
      ]
    },
    "replayed": {
      "type": "boolean"
    }
  },
  "required": [
    "session_id",
    "step_type",
    "completed_steps",
    "timer_verified",
    "replayed"
  ],
  "additionalProperties": false
}
```

### POST /v1/ritual/complete

Complete the ritual once every required step is recorded. First completion for (schedule, local date) wins.

- Auth: JWT
- Errors: `unauthenticated`, `validation_failed`, `rate_limited`, `internal`, `not_found`, `illegal_transition`, `idempotency_key_reuse`

Request body:

```json
{
  "type": "object",
  "properties": {
    "session_id": {
      "type": "string",
      "format": "uuid"
    },
    "idempotency_key": {
      "type": "string",
      "format": "uuid"
    },
    "client_timestamp": {
      "type": "string",
      "format": "date-time"
    }
  },
  "required": [
    "session_id",
    "idempotency_key"
  ],
  "additionalProperties": false
}
```

Response 200:

```json
{
  "type": "object",
  "properties": {
    "session_id": {
      "type": "string",
      "format": "uuid"
    },
    "local_date": {
      "type": "string",
      "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
    },
    "status": {
      "type": "string",
      "enum": [
        "in_progress",
        "completed",
        "abandoned",
        "expired"
      ]
    },
    "completed_at": {
      "type": "string",
      "format": "date-time"
    },
    "timer_verified": {
      "type": [
        "boolean",
        "null"
      ]
    },
    "first_completion_won": {
      "type": "boolean"
    },
    "current_streak": {
      "type": "integer",
      "minimum": 0
    },
    "longest_streak": {
      "type": "integer",
      "minimum": 0
    },
    "replayed": {
      "type": "boolean"
    }
  },
  "required": [
    "session_id",
    "local_date",
    "status",
    "completed_at",
    "timer_verified",
    "first_completion_won",
    "current_streak",
    "longest_streak",
    "replayed"
  ],
  "additionalProperties": false
}
```

### GET /v1/habits/summary

Streaks, week view and counts. Uses server local dates.

- Auth: JWT
- Errors: `unauthenticated`, `validation_failed`, `rate_limited`, `internal`

Response 200:

```json
{
  "type": "object",
  "properties": {
    "local_date": {
      "type": "string",
      "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
    },
    "current_streak": {
      "type": "integer",
      "minimum": 0
    },
    "longest_streak": {
      "type": "integer",
      "minimum": 0
    },
    "grace_days_per_week": {
      "type": "integer",
      "minimum": 0
    },
    "week": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "date": {
            "type": "string",
            "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
          },
          "status": {
            "type": "string",
            "enum": [
              "completed",
              "grace",
              "missed",
              "pending",
              "none"
            ]
          }
        },
        "required": [
          "date",
          "status"
        ],
        "additionalProperties": false
      },
      "minItems": 7,
      "maxItems": 7
    },
    "completed_last_30_days": {
      "type": "integer",
      "minimum": 0,
      "maximum": 30
    },
    "total_completed": {
      "type": "integer",
      "minimum": 0
    }
  },
  "required": [
    "local_date",
    "current_streak",
    "longest_streak",
    "grace_days_per_week",
    "week",
    "completed_last_30_days",
    "total_completed"
  ],
  "additionalProperties": false
}
```

### GET /v1/schedules

List the user's schedules.

- Auth: JWT
- Errors: `unauthenticated`, `validation_failed`, `rate_limited`, `internal`

Response 200:

```json
{
  "type": "object",
  "properties": {
    "schedules": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "name": {
            "type": "string",
            "minLength": 1,
            "maxLength": 60
          },
          "kind": {
            "type": "string",
            "enum": [
              "morning",
              "custom"
            ]
          },
          "enabled": {
            "type": "boolean"
          },
          "weekdays": {
            "type": "array",
            "items": {
              "type": "integer",
              "minimum": 0,
              "maximum": 6
            },
            "minItems": 1,
            "maxItems": 7
          },
          "start_minute": {
            "type": "integer",
            "minimum": 0,
            "maximum": 1439
          },
          "end_minute": {
            "type": "integer",
            "minimum": 1,
            "maximum": 1440
          },
          "timer_seconds": {
            "anyOf": [
              {
                "type": "integer",
                "minimum": 30,
                "maximum": 3600
              },
              {
                "type": "null"
              }
            ]
          },
          "unlock_until": {
            "type": "string",
            "enum": [
              "window_end",
              "midnight"
            ]
          }
        },
        "required": [
          "id",
          "name",
          "kind",
          "enabled",
          "weekdays",
          "start_minute",
          "end_minute",
          "timer_seconds",
          "unlock_until"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "schedules"
  ],
  "additionalProperties": false
}
```

### POST /v1/schedules

Create a schedule.

- Auth: JWT
- Errors: `unauthenticated`, `validation_failed`, `rate_limited`, `internal`, `idempotency_key_reuse`

Request body:

```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 60
    },
    "kind": {
      "type": "string",
      "enum": [
        "morning",
        "custom"
      ]
    },
    "enabled": {
      "type": "boolean"
    },
    "weekdays": {
      "type": "array",
      "items": {
        "type": "integer",
        "minimum": 0,
        "maximum": 6
      },
      "minItems": 1,
      "maxItems": 7
    },
    "start_minute": {
      "type": "integer",
      "minimum": 0,
      "maximum": 1439
    },
    "end_minute": {
      "type": "integer",
      "minimum": 1,
      "maximum": 1440
    },
    "timer_seconds": {
      "anyOf": [
        {
          "type": "integer",
          "minimum": 30,
          "maximum": 3600
        },
        {
          "type": "null"
        }
      ]
    },
    "unlock_until": {
      "type": "string",
      "enum": [
        "window_end",
        "midnight"
      ]
    },
    "idempotency_key": {
      "type": "string",
      "format": "uuid"
    }
  },
  "required": [
    "name",
    "kind",
    "enabled",
    "weekdays",
    "start_minute",
    "end_minute",
    "timer_seconds",
    "unlock_until",
    "idempotency_key"
  ],
  "additionalProperties": false
}
```

Response 200:

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid"
    },
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 60
    },
    "kind": {
      "type": "string",
      "enum": [
        "morning",
        "custom"
      ]
    },
    "enabled": {
      "type": "boolean"
    },
    "weekdays": {
      "type": "array",
      "items": {
        "type": "integer",
        "minimum": 0,
        "maximum": 6
      },
      "minItems": 1,
      "maxItems": 7
    },
    "start_minute": {
      "type": "integer",
      "minimum": 0,
      "maximum": 1439
    },
    "end_minute": {
      "type": "integer",
      "minimum": 1,
      "maximum": 1440
    },
    "timer_seconds": {
      "anyOf": [
        {
          "type": "integer",
          "minimum": 30,
          "maximum": 3600
        },
        {
          "type": "null"
        }
      ]
    },
    "unlock_until": {
      "type": "string",
      "enum": [
        "window_end",
        "midnight"
      ]
    },
    "replayed": {
      "type": "boolean"
    }
  },
  "required": [
    "id",
    "name",
    "kind",
    "enabled",
    "weekdays",
    "start_minute",
    "end_minute",
    "timer_seconds",
    "unlock_until",
    "replayed"
  ],
  "additionalProperties": false
}
```

### POST /v1/learning/quiz

Start a quiz from approved cached questions.

- Auth: JWT
- Entitlement: Rabb.ai Premium required, enforced server side (403 `premium_required`).
- Errors: `unauthenticated`, `validation_failed`, `rate_limited`, `internal`, `premium_required`, `not_found`

Request body:

```json
{
  "type": "object",
  "properties": {
    "lesson_id": {
      "type": "string",
      "format": "uuid"
    },
    "count": {
      "type": "integer",
      "minimum": 1,
      "maximum": 10,
      "default": 5
    }
  },
  "required": [
    "lesson_id"
  ],
  "additionalProperties": false
}
```

Response 200:

```json
{
  "type": "object",
  "properties": {
    "attempt_id": {
      "type": "string",
      "format": "uuid"
    },
    "lesson_id": {
      "type": "string",
      "format": "uuid"
    },
    "questions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "prompt": {
            "type": "string"
          },
          "choices": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "minItems": 2,
            "maxItems": 6
          }
        },
        "required": [
          "id",
          "prompt",
          "choices"
        ],
        "additionalProperties": false
      },
      "minItems": 1
    }
  },
  "required": [
    "attempt_id",
    "lesson_id",
    "questions"
  ],
  "additionalProperties": false
}
```

### POST /v1/learning/answer

Answer a quiz question.

- Auth: JWT
- Entitlement: Rabb.ai Premium required, enforced server side (403 `premium_required`).
- Errors: `unauthenticated`, `validation_failed`, `rate_limited`, `internal`, `premium_required`, `not_found`, `idempotency_key_reuse`

Request body:

```json
{
  "type": "object",
  "properties": {
    "attempt_id": {
      "type": "string",
      "format": "uuid"
    },
    "question_id": {
      "type": "string",
      "format": "uuid"
    },
    "choice_index": {
      "type": "integer",
      "minimum": 0,
      "maximum": 5
    },
    "idempotency_key": {
      "type": "string",
      "format": "uuid"
    }
  },
  "required": [
    "attempt_id",
    "question_id",
    "choice_index",
    "idempotency_key"
  ],
  "additionalProperties": false
}
```

Response 200:

```json
{
  "type": "object",
  "properties": {
    "correct": {
      "type": "boolean"
    },
    "correct_index": {
      "type": "integer",
      "minimum": 0,
      "maximum": 5
    },
    "explanation": {
      "type": [
        "string",
        "null"
      ]
    },
    "attempt_complete": {
      "type": "boolean"
    },
    "score": {
      "anyOf": [
        {
          "type": "integer",
          "minimum": 0
        },
        {
          "type": "null"
        }
      ]
    },
    "replayed": {
      "type": "boolean"
    }
  },
  "required": [
    "correct",
    "correct_index",
    "explanation",
    "attempt_complete",
    "score",
    "replayed"
  ],
  "additionalProperties": false
}
```

### POST /v1/ai/tutor

Ask the AI Bible tutor. Returns verified blocks, or streams them as server sent events when Accept is text/event-stream.

- Auth: JWT
- Entitlement: Rabb.ai Premium required, enforced server side (403 `premium_required`).
- Errors: `unauthenticated`, `validation_failed`, `rate_limited`, `internal`, `premium_required`, `quota_exceeded`, `feature_disabled`

Request body:

```json
{
  "type": "object",
  "properties": {
    "thread_id": {
      "type": "string",
      "format": "uuid"
    },
    "message": {
      "type": "string",
      "minLength": 1,
      "maxLength": 2000
    },
    "translation": {
      "type": "string",
      "minLength": 2,
      "maxLength": 12
    },
    "journal_entry_ids": {
      "type": "array",
      "items": {
        "type": "string",
        "format": "uuid"
      },
      "maxItems": 3
    }
  },
  "required": [
    "message"
  ],
  "additionalProperties": false
}
```

Response 200:

```json
{
  "type": "object",
  "properties": {
    "thread_id": {
      "type": "string",
      "format": "uuid"
    },
    "kind": {
      "type": "string",
      "enum": [
        "answer",
        "no_relevant_content",
        "crisis_support",
        "declined"
      ]
    },
    "blocks": {
      "type": "array",
      "items": {
        "anyOf": [
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "scripture"
              },
              "reference": {
                "type": "object",
                "properties": {
                  "book": {
                    "type": "string",
                    "pattern": "^[1-3A-Z]{3}$"
                  },
                  "chapter": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 150
                  },
                  "verse_start": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 176
                  },
                  "verse_end": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 176
                  }
                },
                "required": [
                  "book",
                  "chapter",
                  "verse_start"
                ],
                "additionalProperties": false
              },
              "translation": {
                "type": "string"
              },
              "text": {
                "type": "string"
              },
              "verified": {
                "type": "boolean",
                "const": true
              }
            },
            "required": [
              "type",
              "reference",
              "translation",
              "text",
              "verified"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "commentary"
              },
              "text": {
                "type": "string",
                "minLength": 1,
                "maxLength": 4000
              },
              "references": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "book": {
                      "type": "string",
                      "pattern": "^[1-3A-Z]{3}$"
                    },
                    "chapter": {
                      "type": "integer",
                      "minimum": 1,
                      "maximum": 150
                    },
                    "verse_start": {
                      "type": "integer",
                      "minimum": 1,
                      "maximum": 176
                    },
                    "verse_end": {
                      "type": "integer",
                      "minimum": 1,
                      "maximum": 176
                    }
                  },
                  "required": [
                    "book",
                    "chapter",
                    "verse_start"
                  ],
                  "additionalProperties": false
                },
                "maxItems": 8
              },
              "label": {
                "type": "string",
                "enum": [
                  "interpretation",
                  "historical_context",
                  "explanation"
                ]
              }
            },
            "required": [
              "type",
              "text",
              "references",
              "label"
            ],
            "additionalProperties": false
          }
        ]
      }
    },
    "fixed_message_id": {
      "type": [
        "string",
        "null"
      ]
    },
    "fixed_message": {
      "type": [
        "string",
        "null"
      ]
    },
    "dropped_unverified_count": {
      "type": "integer",
      "minimum": 0
    }
  },
  "required": [
    "thread_id",
    "kind",
    "blocks",
    "fixed_message_id",
    "fixed_message",
    "dropped_unverified_count"
  ],
  "additionalProperties": false
}
```

### GET /v1/subscription/status

Entitlement status read from the server. The client never trusts a local premium flag.

- Auth: JWT
- Errors: `unauthenticated`, `validation_failed`, `rate_limited`, `internal`

Response 200:

```json
{
  "type": "object",
  "properties": {
    "entitlement": {
      "type": "string",
      "enum": [
        "free",
        "premium"
      ]
    },
    "active": {
      "type": "boolean"
    },
    "product_id": {
      "type": [
        "string",
        "null"
      ]
    },
    "store": {
      "anyOf": [
        {
          "type": "string",
          "enum": [
            "app_store",
            "play_store"
          ]
        },
        {
          "type": "null"
        }
      ]
    },
    "is_trial": {
      "type": "boolean"
    },
    "will_renew": {
      "type": [
        "boolean",
        "null"
      ]
    },
    "expires_at": {
      "anyOf": [
        {
          "type": "string",
          "format": "date-time"
        },
        {
          "type": "null"
        }
      ]
    }
  },
  "required": [
    "entitlement",
    "active",
    "product_id",
    "store",
    "is_trial",
    "will_renew",
    "expires_at"
  ],
  "additionalProperties": false
}
```

### POST /v1/account/delete

Delete the account and all user data.

- Auth: JWT
- Errors: `unauthenticated`, `validation_failed`, `rate_limited`, `internal`

Request body:

```json
{
  "type": "object",
  "properties": {
    "confirm": {
      "type": "string",
      "const": "DELETE"
    }
  },
  "required": [
    "confirm"
  ],
  "additionalProperties": false
}
```

Response 200:

```json
{
  "type": "object",
  "properties": {
    "status": {
      "type": "string",
      "const": "deleted"
    },
    "deleted_at": {
      "type": "string",
      "format": "date-time"
    }
  },
  "required": [
    "status",
    "deleted_at"
  ],
  "additionalProperties": false
}
```

### POST /revenuecat-webhook

RevenueCat webhook. Only writer of subscriptions. Idempotent by event id.

- Auth: webhook authorization secret
- Errors: `unauthenticated`, `validation_failed`, `internal`
- Notes: Authorization header must equal the configured secret. Replays return duplicate with HTTP 200.

Request body:

```json
{
  "type": "object",
  "properties": {
    "api_version": {
      "type": "string"
    },
    "event": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "minLength": 1
        },
        "type": {
          "type": "string",
          "minLength": 1
        },
        "app_user_id": {
          "type": "string",
          "minLength": 1
        },
        "original_app_user_id": {
          "type": "string"
        },
        "product_id": {
          "type": "string"
        },
        "entitlement_ids": {
          "anyOf": [
            {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            {
              "type": "null"
            }
          ]
        },
        "period_type": {
          "type": "string"
        },
        "store": {
          "type": "string"
        },
        "expiration_at_ms": {
          "type": [
            "number",
            "null"
          ]
        },
        "event_timestamp_ms": {
          "type": "number"
        },
        "environment": {
          "type": "string"
        }
      },
      "required": [
        "id",
        "type",
        "app_user_id",
        "event_timestamp_ms"
      ],
      "additionalProperties": false
    }
  },
  "required": [
    "event"
  ],
  "additionalProperties": false
}
```

Response 200:

```json
{
  "type": "object",
  "properties": {
    "status": {
      "type": "string",
      "enum": [
        "processed",
        "duplicate",
        "ignored"
      ]
    }
  },
  "required": [
    "status"
  ],
  "additionalProperties": false
}
```
