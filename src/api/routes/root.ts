import { Request, Response } from 'express';
import DB from '../conn';

export const Root = async (request: Request, response: Response) => {
  const faces = await DB('media').select('*');
  response.send(faces);
};
