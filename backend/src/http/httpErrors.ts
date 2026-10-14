/** The PUT handler requires If-Match but the schema marks it optional, so the handler raises these. */
export class PreconditionRequiredError extends Error {
  constructor() {
    super('If-Match header required');
    this.name = 'PreconditionRequiredError';
  }
}

export class InvalidIfMatchError extends Error {
  constructor() {
    super('If-Match header is malformed');
    this.name = 'InvalidIfMatchError';
  }
}

export class RouteNotFoundError extends Error {
  constructor() {
    super('Route not found');
    this.name = 'RouteNotFoundError';
  }
}
