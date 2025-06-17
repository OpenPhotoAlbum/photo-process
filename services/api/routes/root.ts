import { Request, Response } from 'express';

export const Root = async (request: Request, response: Response) => {
  response.json({
    message: 'Photo Processing API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      gallery: '/api/gallery',
      persons: '/api/persons',
      search: '/api/search',
      jobs: '/api/jobs',
      process: '/api/process',
      media: '/media',
      scan: '/scan'
    },
    documentation: 'Use Thunder Client collection for API testing'
  });
};

export const Health = async (request: Request, response: Response) => {
  response.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'photo-platform-api'
  });
};
